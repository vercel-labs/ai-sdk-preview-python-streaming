import json
import asyncio
import os
from fastapi import FastAPI
from openai import OpenAI
from pydantic import BaseModel
from .utils.prompt import ClientMessage, convert_to_openai_messages
from typing import List
from dotenv import load_dotenv
from .utils.tools import get_current_weather
from fastapi.responses import StreamingResponse


load_dotenv(".env.local")

app = FastAPI()

client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
)


class Request(BaseModel):
    messages: List[ClientMessage]


available_tools = {
    "get_current_weather": get_current_weather,
}


async def fake_video_streamer():
    for i in range(50):
        yield b"some fake video bytes"
        await asyncio.sleep(1)


@app.post("/api/chat")
def hello_world(request: Request):
    messages = request.messages
    openai_messages = convert_to_openai_messages(messages)

    completion = client.chat.completions.create(
        messages=openai_messages,
        model="gpt-4o",
        # tools=[{
        #     "type": "function",
        #     "function": {
        #         "name": "get_current_weather",
        #         "description": "Get the current weather in a given location",
        #         "parameters": {
        #             "type": "object",
        #             "properties": {
        #                 "location": {
        #                     "type": "string",
        #                     "description": "The city and state, e.g. San Francisco, CA",
        #                 },
        #                 "unit": {
        #                     "type": "string",
        #                     "enum": ["celsius", "fahrenheit"]},
        #             },
        #             "required": ["location",],
        #         },
        #     },
        # }]
    )

    return StreamingResponse(fake_video_streamer())

    for choice in completion.choices:
        if choice.message.tool_calls is None:
            return choice.message.content

        # elif choice.message.tool_calls:
        #     openai_messages.append(choice.message)

        #     for tool_call in choice.message.tool_calls:
        #         name = tool_call.function.name
        #         args = json.loads(tool_call.function.arguments)

        #         tool_response = available_tools[name](**args)

        #         openai_messages.append({
        #             "tool_call_id": tool_call.id,
        #             "role": "tool",
        #             "name": name,
        #             "content": json.dumps(tool_response),
        #         })

        #     completion_with_tool_result = client.chat.completions.create(
        #         messages=openai_messages,
        #         model="gpt-4o",
        #     )

        #     for choice in completion_with_tool_result.choices:
        #         if choice.message.tool_calls is None:
        #             return choice.message.content
