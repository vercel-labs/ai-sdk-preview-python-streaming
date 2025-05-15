# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import os
import json
import asyncio
import base64

from pathlib import Path
from dotenv import load_dotenv

from google.genai.types import (
    Part,
    Content,
    Blob,
)

from google.adk.runners import Runner
from google.adk.agents import LiveRequestQueue
from google.adk.agents.run_config import RunConfig
from google.adk.sessions.in_memory_session_service import InMemorySessionService

from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .agents.agents import root_agent

#
# ADK Streaming
#
# Load Gemini API Key
load_dotenv()

APP_NAME = "ADK Streaming example"
session_service = InMemorySessionService()


def start_agent_session(session_id, is_audio=False):
    """Starts an agent session"""

    # Create a Session
    session = session_service.create_session(
        app_name=APP_NAME,
        user_id=session_id,
        session_id=session_id,
    )

    # Create a Runner
    runner = Runner(
        app_name=APP_NAME,
        agent=root_agent,
        session_service=session_service,
    )

    # Set response modality
    modality = "AUDIO" if is_audio else "TEXT"
    run_config = RunConfig(response_modalities=[modality])

    # Create a LiveRequestQueue for this session
    live_request_queue = LiveRequestQueue()

    # Start agent session
    live_events = runner.run_live(
        session=session,
        live_request_queue=live_request_queue,
        run_config=run_config,
    )
    return live_events, live_request_queue


async def agent_to_client_messaging(websocket, live_events):
    """Agent to client communication"""
    try:
        while True:
            async for event in live_events:
                try:
                    # If the turn complete or interrupted, send it
                    if event.turn_complete or event.interrupted:
                        message = {
                            "turn_complete": event.turn_complete,
                            "interrupted": event.interrupted,
                        }
                        await websocket.send_text(json.dumps(message))
                        print(f"[AGENT TO CLIENT]: {message}")
                        continue

                    # Read the Content and its first Part
                    part: Part = (
                        event.content and event.content.parts and event.content.parts[0]
                    )
                    if not part:
                        continue

                    # If it's audio, send Base64 encoded audio data
                    is_audio = part.inline_data and part.inline_data.mime_type.startswith("audio/pcm")
                    if is_audio:
                        audio_data = part.inline_data and part.inline_data.data
                        if audio_data:
                            message = {
                                "mime_type": "audio/pcm",
                                "data": base64.b64encode(audio_data).decode("ascii")
                            }
                            await websocket.send_text(json.dumps(message))
                            print(f"[AGENT TO CLIENT]: audio/pcm: {len(audio_data)} bytes.")
                            continue

                    # If it's text and a parial text, send it
                    if part.text and event.partial:
                        message = {
                            "mime_type": "text/plain",
                            "data": part.text
                        }
                        await websocket.send_text(json.dumps(message))
                        print(f"[AGENT TO CLIENT]: text/plain: {message}")
                except Exception as e:
                    print(f"[AGENT TO CLIENT] Error processing event: {e}")
                    # Send error message to client
                    error_message = {
                        "mime_type": "text/plain",
                        "data": f"Error: {str(e)}",
                        "error": True
                    }
                    await websocket.send_text(json.dumps(error_message))
                    if "quota" in str(e).lower():
                        # Send turn complete to allow client to retry
                        await websocket.send_text(json.dumps({"turn_complete": True}))
                        return  # Exit the loop on quota error
    except Exception as e:
        print(f"[AGENT TO CLIENT] Fatal error: {e}")
        try:
            error_message = {
                "mime_type": "text/plain",
                "data": f"Fatal error: {str(e)}",
                "error": True
            }
            await websocket.send_text(json.dumps(error_message))
            await websocket.send_text(json.dumps({"turn_complete": True}))
        except:
            pass  # Ignore errors during error reporting


async def client_to_agent_messaging(websocket, live_request_queue):
    """Client to agent communication"""
    try:
        while True:
            try:
                # Decode JSON message
                message_json = await websocket.receive_text()
                message = json.loads(message_json)
                mime_type = message["mime_type"]
                data = message["data"]

                # Send the message to the agent
                if mime_type == "text/plain":
                    # Send a text message
                    content = Content(role="user", parts=[Part.from_text(text=data)])
                    live_request_queue.send_content(content=content)
                    print(f"[CLIENT TO AGENT]: {data}")
                elif mime_type == "audio/pcm":
                    # Send an audio data
                    decoded_data = base64.b64decode(data)
                    live_request_queue.send_realtime(Blob(data=decoded_data, mime_type=mime_type))
                else:
                    raise ValueError(f"Mime type not supported: {mime_type}")
            except Exception as e:
                print(f"[CLIENT TO AGENT] Error processing message: {e}")
                # Send error message to client
                error_message = {
                    "mime_type": "text/plain",
                    "data": f"Error processing message: {str(e)}",
                    "error": True
                }
                await websocket.send_text(json.dumps(error_message))
                await websocket.send_text(json.dumps({"turn_complete": True}))
                if "quota" in str(e).lower():
                    return  # Exit the loop on quota error
    except Exception as e:
        print(f"[CLIENT TO AGENT] Fatal error: {e}")
        try:
            error_message = {
                "mime_type": "text/plain",
                "data": f"Fatal error: {str(e)}",
                "error": True
            }
            await websocket.send_text(json.dumps(error_message))
            await websocket.send_text(json.dumps({"turn_complete": True}))
        except:
            pass  # Ignore errors during error reporting


#
# FastAPI web app
#

app = FastAPI()


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: int, is_audio: str):
    """Client websocket endpoint"""
    try:
        # Wait for client connection
        await websocket.accept()
        print(f"Client #{session_id} connected, audio mode: {is_audio}")

        # Start agent session
        session_id = str(session_id)
        live_events, live_request_queue = start_agent_session(session_id, is_audio == "true")

        # Start tasks
        agent_to_client_task = asyncio.create_task(
            agent_to_client_messaging(websocket, live_events)
        )
        client_to_agent_task = asyncio.create_task(
            client_to_agent_messaging(websocket, live_request_queue)
        )

        try:
            await asyncio.gather(agent_to_client_task, client_to_agent_task)
        except Exception as e:
            print(f"Error in websocket tasks: {e}")
            # Send error message to client
            error_message = {
                "mime_type": "text/plain",
                "data": f"Error in websocket tasks: {str(e)}",
                "error": True
            }
            await websocket.send_text(json.dumps(error_message))
            await websocket.send_text(json.dumps({"turn_complete": True}))
    except Exception as e:
        print(f"Error in websocket endpoint: {e}")
    finally:
        # Disconnected
        print(f"Client #{session_id} disconnected")
