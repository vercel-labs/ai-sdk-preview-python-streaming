import json
import traceback
import uuid
from typing import List
from openai.types.chat.chat_completion_message_param import ChatCompletionMessageParam
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi import FastAPI, Query, Request as FastAPIRequest
from fastapi.responses import StreamingResponse
from openai import OpenAI
from .utils.prompt import ClientMessage, convert_to_openai_messages
from .utils.tools import get_current_weather
from vercel import oidc
from vercel.headers import set_headers


load_dotenv(".env.local")

app = FastAPI()


@app.middleware("http")
async def _vercel_set_headers(request: FastAPIRequest, call_next):
    set_headers(dict(request.headers))
    return await call_next(request)


class Request(BaseModel):
    messages: List[ClientMessage]

TOOL_DEFINITIONS = [{
    "type": "function",
    "function": {
        "name": "get_current_weather",
        "description": "Get the current weather at a location",
        "parameters": {
            "type": "object",
            "properties": {
                "latitude": {
                    "type": "number",
                    "description": "The latitude of the location",
                },
                "longitude": {
                    "type": "number",
                    "description": "The longitude of the location",
                },
            },
            "required": ["latitude", "longitude"],
        },
    },
}]


available_tools = {
    "get_current_weather": get_current_weather,
}

def stream_text(client: OpenAI, messages: List[ChatCompletionMessageParam], protocol: str = 'data'):
    try:
        def format_sse(payload: dict) -> str:
            return f"data: {json.dumps(payload, separators=(',', ':'))}\n\n"

        message_id = f"msg-{uuid.uuid4().hex}"
        text_stream_id = "text-1"
        text_started = False
        text_finished = False
        finish_reason = None
        usage_data = None
        tool_calls_state = {}

        yield format_sse({"type": "start", "messageId": message_id})

        stream = client.chat.completions.create(
            messages=messages,
            model="gpt-4o",
            stream=True,
            tools=TOOL_DEFINITIONS,
        )

        for chunk in stream:
            for choice in chunk.choices:
                if choice.finish_reason is not None:
                    finish_reason = choice.finish_reason

                delta = choice.delta
                if delta is None:
                    continue

                if delta.content is not None:
                    if not text_started:
                        yield format_sse({"type": "text-start", "id": text_stream_id})
                        text_started = True
                    yield format_sse(
                        {"type": "text-delta", "id": text_stream_id, "delta": delta.content}
                    )

                if delta.tool_calls:
                    for tool_call_delta in delta.tool_calls:
                        index = tool_call_delta.index
                        state = tool_calls_state.setdefault(
                            index,
                            {
                                "id": None,
                                "name": None,
                                "arguments": "",
                                "started": False,
                            },
                        )

                        if tool_call_delta.id is not None:
                            state["id"] = tool_call_delta.id
                            if (
                                state["id"] is not None
                                and state["name"] is not None
                                and not state["started"]
                            ):
                                yield format_sse(
                                    {
                                        "type": "tool-input-start",
                                        "toolCallId": state["id"],
                                        "toolName": state["name"],
                                    }
                                )
                                state["started"] = True

                        function_call = getattr(tool_call_delta, "function", None)
                        if function_call is not None:
                            if function_call.name is not None:
                                state["name"] = function_call.name
                                if (
                                    state["id"] is not None
                                    and state["name"] is not None
                                    and not state["started"]
                                ):
                                    yield format_sse(
                                        {
                                            "type": "tool-input-start",
                                            "toolCallId": state["id"],
                                            "toolName": state["name"],
                                        }
                                    )
                                    state["started"] = True

                            if function_call.arguments:
                                if (
                                    state["id"] is not None
                                    and state["name"] is not None
                                    and not state["started"]
                                ):
                                    yield format_sse(
                                        {
                                            "type": "tool-input-start",
                                            "toolCallId": state["id"],
                                            "toolName": state["name"],
                                        }
                                    )
                                    state["started"] = True

                                state["arguments"] += function_call.arguments
                                if state["id"] is not None:
                                    yield format_sse(
                                        {
                                            "type": "tool-input-delta",
                                            "toolCallId": state["id"],
                                            "inputTextDelta": function_call.arguments,
                                        }
                                    )

            if not chunk.choices and chunk.usage is not None:
                usage_data = chunk.usage

        if finish_reason == "stop" and text_started and not text_finished:
            yield format_sse({"type": "text-end", "id": text_stream_id})
            text_finished = True

        if finish_reason == "tool_calls":
            for index in sorted(tool_calls_state.keys()):
                state = tool_calls_state[index]
                tool_call_id = state.get("id")
                tool_name = state.get("name")

                if tool_call_id is None or tool_name is None:
                    continue

                if not state["started"]:
                    yield format_sse(
                        {
                            "type": "tool-input-start",
                            "toolCallId": tool_call_id,
                            "toolName": tool_name,
                        }
                    )
                    state["started"] = True

                raw_arguments = state["arguments"]
                try:
                    parsed_arguments = json.loads(raw_arguments) if raw_arguments else {}
                except Exception as error:
                    yield format_sse(
                        {
                            "type": "tool-input-error",
                            "toolCallId": tool_call_id,
                            "toolName": tool_name,
                            "input": raw_arguments,
                            "errorText": str(error),
                        }
                    )
                    continue

                yield format_sse(
                    {
                        "type": "tool-input-available",
                        "toolCallId": tool_call_id,
                        "toolName": tool_name,
                        "input": parsed_arguments,
                    }
                )

                tool_function = available_tools.get(tool_name)
                if tool_function is None:
                    yield format_sse(
                        {
                            "type": "tool-output-error",
                            "toolCallId": tool_call_id,
                            "errorText": f"Tool '{tool_name}' not found.",
                        }
                    )
                    continue

                try:
                    tool_result = tool_function(**parsed_arguments)
                except Exception as error:
                    yield format_sse(
                        {
                            "type": "tool-output-error",
                            "toolCallId": tool_call_id,
                            "errorText": str(error),
                        }
                    )
                else:
                    yield format_sse(
                        {
                            "type": "tool-output-available",
                            "toolCallId": tool_call_id,
                            "output": tool_result,
                        }
                    )

        if text_started and not text_finished:
            yield format_sse({"type": "text-end", "id": text_stream_id})
            text_finished = True

        finish_metadata = {}
        if finish_reason is not None:
            finish_metadata["finishReason"] = finish_reason.replace("_", "-")

        if usage_data is not None:
            usage_payload = {
                "promptTokens": usage_data.prompt_tokens,
                "completionTokens": usage_data.completion_tokens,
            }
            total_tokens = getattr(usage_data, "total_tokens", None)
            if total_tokens is not None:
                usage_payload["totalTokens"] = total_tokens
            finish_metadata["usage"] = usage_payload

        if finish_metadata:
            yield format_sse({"type": "finish", "messageMetadata": finish_metadata})
        else:
            yield format_sse({"type": "finish"})

        yield "data: [DONE]\n\n"
    except Exception:
        traceback.print_exc()
        raise




@app.post("/api/chat")
async def handle_chat_data(request: Request, protocol: str = Query('data')):
    messages = request.messages
    openai_messages = convert_to_openai_messages(messages)

    client = OpenAI(api_key=oidc.get_vercel_oidc_token(), base_url="https://ai-gateway.vercel.sh/v1")
    response = StreamingResponse(
        stream_text(client, openai_messages, protocol), media_type="text/event-stream"
    )
    response.headers['x-vercel-ai-ui-message-stream'] = 'v1'
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['Connection'] = 'keep-alive'
    response.headers['X-Accel-Buffering'] = 'no'
    return response
