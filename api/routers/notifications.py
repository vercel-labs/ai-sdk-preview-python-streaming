from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from ..utils.websocket_manager import connection_manager
from ..core.config import settings

router = APIRouter()

@router.websocket("/ws/photos/{photo_id}")
async def websocket_endpoint(websocket: WebSocket, photo_id: int):
    """WebSocket endpoint for clients to receive status updates for a photo."""
    await connection_manager.connect(photo_id, websocket)
    try:
        while True:
            # Keep connection alive. We don't expect messages from client for now.
            await websocket.receive_text()
    except WebSocketDisconnect:
        connection_manager.disconnect(photo_id, websocket) 