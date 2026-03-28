"""
ConnectionManager: tracks live WebSocket connections per canvas room.

Think of each canvas as a chat room. When a client opens a canvas:
  1. They connect → added to the room's set
  2. Any message in that room → forwarded to every other connection
  3. They disconnect → removed from the set

This is a simple in-process broadcast. If we scaled to multiple server
instances we'd need a pub/sub layer (Redis, etc.), but for one server
this dict-of-sets is sufficient.
"""

import asyncio
import json
from typing import Dict, Set

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        # canvas_id -> set of live WebSocket connections
        self.rooms: Dict[str, Set[WebSocket]] = {}

    def connect(self, canvas_id: str, ws: WebSocket) -> None:
        if canvas_id not in self.rooms:
            self.rooms[canvas_id] = set()
        self.rooms[canvas_id].add(ws)

    def disconnect(self, canvas_id: str, ws: WebSocket) -> None:
        room = self.rooms.get(canvas_id)
        if room:
            room.discard(ws)
            if not room:
                del self.rooms[canvas_id]

    async def broadcast(self, canvas_id: str, message: str, exclude: WebSocket | None = None) -> None:
        """Send message to every connection in the room except `exclude`."""
        room = self.rooms.get(canvas_id)
        if not room:
            return
        # Snapshot the set so we don't mutate while iterating
        dead: list[WebSocket] = []
        tasks = []
        for ws in list(room):
            if ws is exclude:
                continue
            tasks.append(_safe_send(ws, message, dead))
        if tasks:
            await asyncio.gather(*tasks)
        for ws in dead:
            room.discard(ws)


async def _safe_send(ws: WebSocket, message: str, dead: list) -> None:
    try:
        await ws.send_text(message)
    except Exception:
        dead.append(ws)


# Module-level singleton — imported by main.py and shapes.py
manager = ConnectionManager()
