import json
import logging
import os
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, Query
from fastapi.responses import StreamingResponse
from openai import OpenAI
from openai.types.chat.chat_completion_message_param import ChatCompletionMessageParam
from pydantic import BaseModel

from api.utils.trie import create_trie_from_wordlist

from .utils.prompt import ClientMessage, convert_to_openai_messages
from .utils.schemas import TOOL_DEFINITIONS, get_tool_definitions
from .utils.tools import WEATHER_TOOL, get_current_weather

# Add logging configuration at the top of the file
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv(".env.local")

app = FastAPI()
MODEL = "gemini-2.0-flash"
client = OpenAI(
    api_key=os.environ.get("GEMINI_API_KEY"),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
)

# TODO: move to relative path
trie = create_trie_from_wordlist(
    "/Users/oniken/Projects/ai-sdk-preview-python-streaming/api/utils/wordlist.txt"
)


class Request(BaseModel):
    messages: List[ClientMessage]


class AutocompleteRequest(BaseModel):
    query: str
    max_results: int = 10


# Simply map function names to implementations
available_tools = {
    WEATHER_TOOL: get_current_weather,
}

# Optional runtime validation
for tool_name in available_tools:
    if tool_name not in TOOL_DEFINITIONS:
        raise ValueError(
            f"Tool '{tool_name}' has implementation but no schema definition"
        )


def stream_text(messages: List[ChatCompletionMessageParam], protocol: str = "data"):
    draft_tool_calls = []
    draft_tool_calls_index = -1

    # Convert messages to format Gemini can understand
    api_messages = []
    for msg in messages:
        if isinstance(msg, dict):
            role = msg.get("role", "")

            if role == "tool":
                # Convert tool message to assistant message
                tool_content = msg.get("content", "")
                api_messages.append(
                    {"role": "assistant", "content": f"Tool response: {tool_content}"}
                )
            else:
                # Extract content based on type
                if isinstance(msg.get("content"), list):
                    text_content = ""
                    for content_item in msg["content"]:
                        if content_item.get("type") == "text":
                            text_content += content_item.get("text", "")
                    api_messages.append({"role": role, "content": text_content})
                else:
                    api_messages.append(
                        {"role": role, "content": msg.get("content", "")}
                    )
        elif hasattr(msg, "role"):
            if msg.role == "tool":
                api_messages.append(
                    {"role": "assistant", "content": f"Tool response: {msg.content}"}
                )
            else:
                api_messages.append({"role": msg.role, "content": msg.content})

    try:
        stream = client.chat.completions.create(
            messages=api_messages,
            model=MODEL,
            stream=True,
            tools=get_tool_definitions(),
        )

        for chunk in stream:
            for choice in chunk.choices:
                if choice.finish_reason == "stop":
                    if hasattr(choice.delta, "content") and choice.delta.content:
                        yield "0:{text}\n".format(text=json.dumps(choice.delta.content))

                    # Then send the end marker
                    prompt_tokens = 0
                    completion_tokens = 0

                    if hasattr(chunk, "usage") and chunk.usage:
                        usage = chunk.usage
                        prompt_tokens = getattr(usage, "prompt_tokens", 0)
                        completion_tokens = getattr(usage, "completion_tokens", 0)

                    yield 'e:{{"finishReason":"stop","usage":{{"promptTokens":{prompt},"completionTokens":{completion}}},"isContinued":false}}\n'.format(
                        prompt=prompt_tokens, completion=completion_tokens
                    )
                    continue

                elif choice.delta.tool_calls:
                    for tool_call in choice.delta.tool_calls:
                        tool_id = getattr(tool_call, "id", "")

                        if hasattr(tool_call, "function"):
                            function = tool_call.function
                            name = getattr(function, "name", "")
                            arguments = getattr(function, "arguments", "")
                        else:
                            name = ""
                            arguments = ""

                        if (
                            not tool_id
                            and hasattr(tool_call, "index")
                            and tool_call.index is not None
                        ):
                            if (
                                draft_tool_calls_index >= 0
                                and len(draft_tool_calls) > 0
                            ):
                                draft_tool_calls[draft_tool_calls_index][
                                    "arguments"
                                ] += arguments
                        else:
                            if name:
                                draft_tool_calls_index += 1
                                draft_tool_calls.append(
                                    {
                                        "id": tool_id
                                        or f"call_{draft_tool_calls_index}",
                                        "name": name,
                                        "arguments": arguments or "",
                                    }
                                )

                # Process tool calls when ready
                if choice.finish_reason == "tool_calls" and draft_tool_calls:
                    # First announce all tool calls
                    for tool_call in draft_tool_calls:
                        yield '9:{{"toolCallId":"{id}","toolName":"{name}","args":{args}}}\n'.format(
                            id=tool_call["id"],
                            name=tool_call["name"],
                            args=tool_call["arguments"],
                        )

                    # Then execute them and return results
                    for tool_call in draft_tool_calls:
                        try:
                            if tool_call["name"] in available_tools:
                                args = json.loads(tool_call["arguments"])
                                tool_result = available_tools[tool_call["name"]](**args)

                                yield 'a:{{"toolCallId":"{id}","toolName":"{name}","args":{args},"result":{result}}}\n'.format(
                                    id=tool_call["id"],
                                    name=tool_call["name"],
                                    args=tool_call["arguments"],
                                    result=json.dumps(tool_result),
                                )
                            else:
                                error_msg = f"Tool {tool_call['name']} not found"
                                yield 'a:{{"toolCallId":"{id}","toolName":"{name}","args":{args},"result":{{"error":{error}}}}}}\n'.format(
                                    id=tool_call["id"],
                                    name=tool_call["name"],
                                    args=tool_call["arguments"],
                                    error=json.dumps(error_msg),
                                )
                        except Exception as e:
                            error_msg = f"Error executing tool: {str(e)}"
                            yield 'a:{{"toolCallId":"{id}","toolName":"{name}","args":{args},"result":{{"error":{error}}}}}}\n'.format(
                                id=tool_call["id"],
                                name=tool_call["name"],
                                args=tool_call["arguments"],
                                error=json.dumps(error_msg),
                            )

                else:
                    yield "0:{text}\n".format(text=json.dumps(choice.delta.content))

    except Exception as e:
        yield f'e:{{"finishReason":"error","error":{json.dumps(str(e))},"isContinued":false}}\n'


@app.post("/api/chat/gemini")
async def handle_chat_data(request: Request, protocol: str = Query("data")):
    messages = request.messages
    openai_messages = convert_to_openai_messages(messages)

    response = StreamingResponse(stream_text(openai_messages, protocol))
    response.headers["x-vercel-ai-data-stream"] = "v1"
    return response


@app.post("/api/autocomplete")
async def handle_autocomplete(request: dict):
    """
    Autocomplete endpoint that returns word suggestions based on a query prefix.
    Returns a list of objects with 'text' field containing matching words.
    """
    try:
        # Extract query from request body
        query = request.get("query", "")
        print(f"Query: {query}")
        max_results = request.get("max_results", 10)

        # Search for words matching the query prefix
        words = trie.search(query, max_results=max_results)

        # Format response as list of objects with 'text' field
        suggestions = [{"text": word} for word in words]
        print(f"Suggestions: {suggestions}")

        return suggestions

    except Exception as e:
        logger.error(f"Error in autocomplete: {str(e)}")
        return []
