import asyncio
import json
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError

from app.auth import decode_token
from app.db import close_pool, get_pool
from app.routes.canvases import router as canvases_router
from app.routes.shapes import router as shapes_router
from app.routes.users import router as users_router
from app.ws import manager


async def init_schema(pool) -> None:
    """Run schema.sql at startup. All statements are IF NOT EXISTS so this is idempotent."""
    schema_path = Path(__file__).parent.parent / "schema.sql"
    sql = schema_path.read_text()
    async with pool.acquire() as conn:
        await conn.execute(sql)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Retry loop: Docker sometimes starts the app before Postgres is ready.
    for attempt in range(10):
        try:
            pool = await get_pool()
            await init_schema(pool)
            break
        except Exception as e:
            if attempt == 9:
                raise
            await asyncio.sleep(2)
    yield
    await close_pool()


app = FastAPI(lifespan=lifespan)

# CORS: tells browsers to allow requests from the Vite dev server.
# Like a firewall rule: allow origin localhost:5173 to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users_router)
app.include_router(canvases_router)
app.include_router(shapes_router)


@app.get("/health")
async def health() -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.fetchval("SELECT 1")
    return {"ok": True}


@app.websocket("/ws/{canvas_id}")
async def websocket_endpoint(ws: WebSocket, canvas_id: str, token: str = "") -> None:
    # Validate the JWT from the ?token= query param before accepting.
    # Like a bouncer checking ID before letting someone into the room.
    try:
        payload = decode_token(token)
        user_id: str = payload["sub"]
        username: str = payload["username"]
    except (JWTError, KeyError):
        # Reject without accepting — client gets a 403 at the HTTP upgrade.
        return

    await ws.accept()
    manager.connect(canvas_id, ws)
    try:
        while True:
            data = await ws.receive_text()
            try:
                msg = json.loads(data)
                msg_type = msg.get("type")
                if msg_type == "cursor_move":
                    # Attach server-verified identity, then broadcast to room.
                    out = json.dumps({
                        "type": "cursor_move",
                        "payload": {
                            **msg.get("payload", {}),
                            "user_id": user_id,
                            "username": username,
                        },
                    })
                    await manager.broadcast(canvas_id, out, exclude=ws)
            except Exception:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(canvas_id, ws)
