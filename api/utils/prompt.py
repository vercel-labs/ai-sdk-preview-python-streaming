import json
from openai.types.chat.chat_completion_message_param import ChatCompletionMessageParam
from pydantic import BaseModel
from typing import List, Any

# AI SDK v5 UIMessage format
class ClientMessage(BaseModel):
    id: str
    role: str
    parts: List[Any]  # v5 parts array (required)

def convert_to_openai_messages(messages: List[ClientMessage]) -> List[ChatCompletionMessageParam]:
    """
    Convert AI SDK v5 UIMessages to OpenAI message format.
    """
    openai_messages = []

    for message in messages:
        content_parts = []
        tool_calls = []

        # Process v5 parts array
        for part in message.parts:
            if isinstance(part, dict):
                part_type = part.get('type')
                
                # Text parts
                if part_type == 'text':
                    content_parts.append({
                        'type': 'text',
                        'text': part.get('text', '')
                    })
                
                # File/Image parts
                elif part_type == 'file':
                    media_type = part.get('mediaType', '')
                    if media_type.startswith('image'):
                        content_parts.append({
                            'type': 'image_url',
                            'image_url': {
                                'url': part.get('url')
                            }
                        })
                
                # Tool call parts (for assistant messages)
                elif part_type == 'tool-call':
                    tool_calls.append({
                        "id": part.get('toolCallId'),
                        "type": "function",
                        "function": {
                            "name": part.get('toolName'),
                            "arguments": json.dumps(part.get('input', {}))
                        }
                    })

        # Add message with content and/or tool calls
        if content_parts or tool_calls:
            msg = {
                "role": message.role,
                "content": content_parts if content_parts else None,
            }
            if tool_calls:
                msg["tool_calls"] = tool_calls
            openai_messages.append(msg)

        # Add tool result messages (separate messages for tool outputs)
        for part in message.parts:
            if isinstance(part, dict) and part.get('type') == 'tool-call' and part.get('state') == 'result':
                tool_message = {
                    "role": "tool",
                    "tool_call_id": part.get('toolCallId'),
                    "content": json.dumps(part.get('result')),
                }
                openai_messages.append(tool_message)

    return openai_messages
