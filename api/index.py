import json
import logging
from typing import List
from openai.types.chat.chat_completion_message_param import ChatCompletionMessageParam
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi import FastAPI, Query, Request as FastAPIRequest
from fastapi.responses import StreamingResponse
from openai import OpenAI
from vercel import oidc
from vercel.headers import set_headers
from .utils.prompt import ClientMessage, convert_to_openai_messages
from .utils.tools import get_current_weather

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


load_dotenv(".env.local")

app = FastAPI()

@app.middleware("http")
async def vercel_headers_middleware(request: FastAPIRequest, call_next):
    set_headers(dict(request.headers))
    return await call_next(request)


class Request(BaseModel):
    messages: List[ClientMessage]


available_tools = {
    "get_current_weather": get_current_weather,
}

def get_client():
    token = oidc.get_vercel_oidc_token()
    logger.info(f"OIDC token obtained: {bool(token)}, length: {len(token) if token else 0}")
    client = OpenAI(api_key=token, base_url="https://ai-gateway.vercel.sh/v1")
    logger.info(f"OpenAI client created with base_url: {client.base_url}")
    return client

def do_stream(messages: List[ChatCompletionMessageParam]):
    stream = get_client().chat.completions.create(
        messages=messages,
        model="gpt-4o",
        stream=True,
        tools=[{
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
    )

    return stream

def stream_text(messages: List[ChatCompletionMessageParam], protocol: str = 'data'):
    draft_tool_calls = []
    draft_tool_calls_index = -1

    logger.info(f"stream_text called with {len(messages)} messages, protocol={protocol}")

    try:
        client = get_client()
        logger.info("Creating chat completion stream...")
        stream = client.chat.completions.create(
            messages=messages,
            model="gpt-4o",
            stream=True,
            tools=[{
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
        )
        logger.info("Stream created successfully")
    except Exception as e:
        logger.error(f"Failed to create stream: {type(e).__name__}: {e}")
        raise

    chunk_count = 0
    for chunk in stream:
        chunk_count += 1
        if chunk_count <= 3:
            logger.info(f"Chunk {chunk_count}: choices={len(chunk.choices)}, finish_reason={chunk.choices[0].finish_reason if chunk.choices else 'no-choices'}")
        for choice in chunk.choices:
            if choice.finish_reason == "stop":
                continue

            elif choice.finish_reason == "tool_calls":
                for tool_call in draft_tool_calls:
                    yield '9:{{"toolCallId":"{id}","toolName":"{name}","args":{args}}}\n'.format(
                        id=tool_call["id"],
                        name=tool_call["name"],
                        args=tool_call["arguments"])

                for tool_call in draft_tool_calls:
                    tool_result = available_tools[tool_call["name"]](
                        **json.loads(tool_call["arguments"]))

                    yield 'a:{{"toolCallId":"{id}","toolName":"{name}","args":{args},"result":{result}}}\n'.format(
                        id=tool_call["id"],
                        name=tool_call["name"],
                        args=tool_call["arguments"],
                        result=json.dumps(tool_result))

            elif choice.delta.tool_calls:
                for tool_call in choice.delta.tool_calls:
                    id = tool_call.id
                    name = tool_call.function.name
                    arguments = tool_call.function.arguments

                    if (id is not None):
                        draft_tool_calls_index += 1
                        draft_tool_calls.append(
                            {"id": id, "name": name, "arguments": ""})

                    else:
                        draft_tool_calls[draft_tool_calls_index]["arguments"] += arguments

            else:
                yield '0:{text}\n'.format(text=json.dumps(choice.delta.content))

        if chunk.choices == []:
            usage = chunk.usage
            prompt_tokens = usage.prompt_tokens
            completion_tokens = usage.completion_tokens

            yield 'e:{{"finishReason":"{reason}","usage":{{"promptTokens":{prompt},"completionTokens":{completion}}},"isContinued":false}}\n'.format(
                reason="tool-calls" if len(
                    draft_tool_calls) > 0 else "stop",
                prompt=prompt_tokens,
                completion=completion_tokens
            )




@app.post("/api/chat")
async def handle_chat_data(request: Request, protocol: str = Query('data')):
    logger.info(f"POST /api/chat — {len(request.messages)} messages, protocol={protocol}")
    messages = request.messages
    openai_messages = convert_to_openai_messages(messages)
    logger.info(f"Converted to {len(openai_messages)} OpenAI messages")

    response = StreamingResponse(stream_text(openai_messages, protocol))
    response.headers['x-vercel-ai-data-stream'] = 'v1'
    return response
