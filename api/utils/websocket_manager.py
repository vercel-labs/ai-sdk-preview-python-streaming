from typing import Dict, List, Any
from fastapi import WebSocket

class ConnectionManager:
    """Manages WebSocket connections grouped by photo_id."""

    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, photo_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.setdefault(photo_id, []).append(websocket)

    def disconnect(self, photo_id: int, websocket: WebSocket):
        if photo_id in self.active_connections:
            try:
                self.active_connections[photo_id].remove(websocket)
                if not self.active_connections[photo_id]:
                    del self.active_connections[photo_id]
            except ValueError:
                pass

    async def send_json(self, photo_id: int, data: Any):
        """Send JSON data to all clients listening for the given photo_id."""
        connections = self.active_connections.get(photo_id, [])
        for websocket in connections:
            await websocket.send_json(data)

# Singleton instance
connection_manager = ConnectionManager() 