import os
import json
import uuid
from typing import List
from openai.types.chat.chat_completion_message_param import ChatCompletionMessageParam
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi import FastAPI, Query
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI
from .utils.prompt import ClientMessage, convert_to_openai_messages
from .utils.tools import get_current_weather


load_dotenv(".env.local")

app = FastAPI()

client = AsyncOpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
)


class Request(BaseModel):
    messages: List[ClientMessage]


available_tools = {
    "get_current_weather": get_current_weather,
}

async def stream_text(messages: List[ChatCompletionMessageParam], protocol: str = 'data'):
    # v5 data stream protocol: https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol#data-stream-protocol
    message_id = f"msg_{uuid.uuid4().hex}"
    
    # Start message
    yield f'data: {json.dumps({"type": "start", "messageId": message_id})}\n\n'

    # Tool calling loop - continue until we get a final response
    conversation_messages = list(messages)
    
    while True:
        text_id = f"text_{uuid.uuid4().hex}"
        text_started = False
        draft_tool_calls = []
        draft_tool_calls_index = -1

        stream = await client.chat.completions.create(
            messages=conversation_messages,
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

        finish_reason = None
        
        async for chunk in stream:
            for choice in chunk.choices:
                # Handle tool calls streaming
                if choice.delta.tool_calls:
                    for tool_call in choice.delta.tool_calls:
                        id = tool_call.id
                        name = tool_call.function.name
                        arguments = tool_call.function.arguments

                        if (id is not None):
                            draft_tool_calls_index += 1
                            draft_tool_calls.append(
                                {"id": id, "name": name, "arguments": ""})
                            
                            yield f'data: {json.dumps({"type": "tool-input-start", "toolCallId": id, "toolName": name})}\n\n'

                        if arguments:
                            draft_tool_calls[draft_tool_calls_index]["arguments"] += arguments
                            yield f'data: {json.dumps({"type": "tool-input-delta", "toolCallId": draft_tool_calls[draft_tool_calls_index]["id"], "inputTextDelta": arguments})}\n\n'
                
                # Handle text content streaming
                if choice.delta.content:
                    if not text_started:
                        yield f'data: {json.dumps({"type": "text-start", "id": text_id})}\n\n'
                        text_started = True
                    
                    yield f'data: {json.dumps({"type": "text-delta", "id": text_id, "delta": choice.delta.content})}\n\n'
                
                # Capture finish reason
                if choice.finish_reason:
                    finish_reason = choice.finish_reason

        # End text block if started
        if text_started:
            yield f'data: {json.dumps({"type": "text-end", "id": text_id})}\n\n'
            text_started = False

        # Handle finish reasons
        if finish_reason == "tool_calls":
            # Build tool call objects for the assistant message
            tool_calls_for_message = [
                {
                    "id": tc["id"],
                    "type": "function",
                    "function": {
                        "name": tc["name"],
                        "arguments": tc["arguments"]
                    }
                }
                for tc in draft_tool_calls
            ]
            
            # Add assistant message with tool calls
            conversation_messages.append({
                "role": "assistant",
                "tool_calls": tool_calls_for_message
            })
            
            # Execute tools and emit events
            for tool_call in draft_tool_calls:
                parsed_args = json.loads(tool_call["arguments"])
                
                yield f'data: {json.dumps({"type": "tool-input-available", "toolCallId": tool_call["id"], "toolName": tool_call["name"], "input": parsed_args})}\n\n'

                tool_result = available_tools[tool_call["name"]](**parsed_args)

                yield f'data: {json.dumps({"type": "tool-output-available", "toolCallId": tool_call["id"], "output": tool_result})}\n\n'
                
                # Add tool result to conversation
                conversation_messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "content": json.dumps(tool_result)
                })
            
            yield f'data: {json.dumps({"type": "finish-step"})}\n\n'
            
            # Continue the loop to get the final response
            continue
            
        elif finish_reason == "stop":
            # Conversation is complete
            break

    # Finish message
    yield f'data: {json.dumps({"type": "finish"})}\n\n'
    yield f'data: [DONE]\n\n'




@app.post("/api/chat")
async def handle_chat_data(request: Request, protocol: str = Query('data')):
    try:
        messages = request.messages
        openai_messages = convert_to_openai_messages(messages)

        return StreamingResponse(
            stream_text(openai_messages, protocol),
            media_type="text/event-stream",
            headers={
                'x-vercel-ai-ui-message-stream': 'v1',
                'Cache-Control': 'no-cache, no-transform',
                'X-Accel-Buffering': 'no',
                'Connection': 'keep-alive',
                'Content-Type': 'text/event-stream',
            }
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise
