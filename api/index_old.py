import os
import json
from typing import List, Optional
from openai.types.chat.chat_completion_message_param import ChatCompletionMessageParam
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi import FastAPI, Query
from fastapi.responses import StreamingResponse
from openai import OpenAI
from .utils.prompt import ClientMessage, convert_to_openai_messages
from .utils.tools import get_current_weather
from .agents.agents import root_agent  
from google.adk.sessions import InMemorySessionService, Session
import os
import asyncio
from google.adk.agents import Agent
from google.adk.sessions import InMemorySessionService
from google.adk.runners import Runner
from google.genai import types # For creating message Content/Parts
from dotenv import load_dotenv
# @title Define Agent Interaction Function
import asyncio
from google.genai import types # For creating message Content/Parts
# @title 2. Create State-Aware Weather Tool
from google.genai import types # For creating response content

# Import your root agent
 # or wherever your ADK context class is defined


load_dotenv(".env.local")

app = FastAPI()

client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
)


class Request(BaseModel):
    messages: List[ClientMessage]

class AgentRequest(BaseModel):
    message: str
    context: Optional[dict] = None


available_tools = {
    "get_current_weather": get_current_weather,
}

def do_stream(messages: List[ChatCompletionMessageParam]):
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

    return stream

def stream_text(messages: List[ChatCompletionMessageParam], protocol: str = 'data'):
    draft_tool_calls = []
    draft_tool_calls_index = -1

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

    for chunk in stream:
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


async def call_agent_async(query: str, runner: Runner, user_id: str, session_id: str):
    print(f"\n>>> User Query: {query}")
    content = types.Content(role='user', parts=[types.Part(text=query)])

    async def event_stream():
        yield "data: 🤖 Thinking...\n\n"

        try:
            async for event in runner.run_async(user_id=user_id, session_id=session_id, new_message=content):
                print(f"🧠 Agent event: {event}")
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if part.text:
                            # SSE format
                            yield f"data: {part.text}\n\n"
                if event.is_final_response():
                    return
        except Exception as e:
            print(f"❌ Error: {e}")
            yield f"data: ❌ Error: {e}\n\n"

    return event_stream()
  # ✅ return the generator instance
@app.post("/api/chat")
async def handle_chat_data(request: Request, protocol: str = Query('data')):
    try:
        last_message = request.messages[-1].content if request.messages else ""
        print(last_message)
        APP_NAME = "Weather App"
        session_service_stateful = InMemorySessionService()
        print("✅ New InMemorySessionService created for state demonstration.")

        # Define a NEW session ID for this part of the tutorial
        SESSION_ID_STATEFUL = "session_state_demo_001"
        USER_ID_STATEFUL = "user_state_demo"

        # Define initial state data - user prefers Celsius initially
        initial_state = {
            "user_preference_temperature_unit": "Celsius"
        }

        # Create the session, providing the initial state
        session_stateful = session_service_stateful.create_session(
            app_name=APP_NAME, # Use the consistent app name
            user_id=USER_ID_STATEFUL,
            session_id=SESSION_ID_STATEFUL,
            state=initial_state # <<< Initialize state during creation
        )
        print(f"✅ Session '{SESSION_ID_STATEFUL}' created for user '{USER_ID_STATEFUL}'.")
        # --- Create Runner for this Root Agent & NEW Session Service ---
        runner_root_stateful = Runner(
            agent=root_agent,
            app_name=APP_NAME,
            session_service=session_service_stateful # Use the NEW stateful session service
        )
        print(f"✅ Runner created for stateful root agent '{runner_root_stateful.agent.name}' using stateful session service.")
        response_stream = await call_agent_async(last_message, runner_root_stateful, USER_ID_STATEFUL, SESSION_ID_STATEFUL)
        response = StreamingResponse(response_stream, media_type="text/event-stream")
        response.headers["Cache-Control"] = "no-cache"
        response.headers["x-vercel-ai-data-stream"] = "v1"
        return response
        # TEMP: iterate the stream to trigger the async generator
        # async for chunk in response_stream:
        #     print(f"Streamed: {chunk}")

        # # Just return a dummy response instead of streaming (for now)
        # return {"status": "done"}
        #return response

    except Exception as e:
        print(f"Error in handle_chat_data: {str(e)}")
        return {"error": str(e)}

@app.post("/api/chatx")
async def handle_chat_data(request: Request, protocol: str = Query('data')):
    messages = request.messages
    openai_messages = convert_to_openai_messages(messages)
    

    response = StreamingResponse(stream_text(openai_messages, protocol))
    response.headers['x-vercel-ai-data-stream'] = 'v1'
    print(f"Response: {response}")
    return response
