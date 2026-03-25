# Collaborative Whiteboard

A real-time multiplayer whiteboard app. Multiple users can draw, move, resize, and delete shapes on a shared canvas simultaneously, with live cursor tracking and per-user undo/redo.

## Features

- **User accounts** — sign up, log in, log out
- **Canvas management** — create canvases, invite collaborators by username or email, copy canvases
- **Shapes** — rectangle, ellipse, line, text
- **Editing** — select, move, resize, delete, change color; double-click text to edit it
- **Real-time sync** — changes appear instantly on all connected clients via WebSocket
- **Live cursors** — see where other users are pointing
- **Undo / redo** — per-user history stack (Ctrl+Z / Ctrl+Shift+Z), also available as toolbar buttons
- **Persistence** — all shapes saved to PostgreSQL; canvas state survives refreshes and reconnects

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Backend | FastAPI, Python 3.12, asyncpg |
| Database | PostgreSQL 16 (JSONB for shape data) |
| Auth | JWT (python-jose) + bcrypt |
| Real-time | WebSocket (FastAPI/Starlette) |

## Running

Requires [Docker](https://docs.docker.com/get-docker/) and Docker Compose.

```bash
docker compose up --build
```

Opens at **http://localhost:5173**.

This starts three containers: PostgreSQL on 5432, the FastAPI backend on 3001, and the Vite frontend on 5173. The database schema is applied automatically on first start.

## Running without Docker

You need a running PostgreSQL instance. Default connection string: `postgres://whiteboard:whiteboard@localhost:5432/whiteboard`.

```bash
# Start only the database
docker compose up db

# Backend
cd server
pip install -e .
uvicorn app.main:app --reload --port 3001

# Frontend (separate terminal)
cd client
npm install
npm run dev
```

## Project structure

```
├── client/
│   └── src/
│       ├── App.tsx                  # View routing (auth / dashboard / canvas)
│       ├── api.ts                   # HTTP client + localStorage auth
│       ├── components/
│       │   ├── AuthPage.tsx         # Login / signup
│       │   ├── CanvasPage.tsx       # Drawing surface (SVG)
│       │   ├── Dashboard.tsx        # Canvas list
│       │   ├── Toolbar.tsx          # Tool + color picker
│       │   ├── Cursors.tsx          # Remote cursor overlay
│       │   ├── InviteModal.tsx
│       │   └── CopyCanvasModal.tsx
│       └── hooks/
│           ├── useShapes.ts         # Shape state + REST mutations
│           ├── useHistory.ts        # Undo/redo stack
│           ├── useWebSocket.ts      # WS connection + message routing
│           └── useCursors.ts        # Remote cursor state
├── server/
│   └── app/
│       ├── main.py                  # FastAPI app + WebSocket endpoint
│       ├── auth.py                  # JWT + bcrypt helpers
│       ├── db.py                    # asyncpg connection pool
│       ├── ws.py                    # ConnectionManager (in-process broadcast)
│       └── routes/
│           ├── users.py             # /api/auth/*
│           ├── canvases.py          # /api/canvases/*
│           └── shapes.py            # /api/canvases/{id}/shapes/*
├── schema.sql                       # All table definitions (IF NOT EXISTS)
└── docker-compose.yml
```

## Architecture notes

- **REST for writes, WebSocket for broadcast** — all mutations go through REST endpoints; the server broadcasts to the canvas room after each successful DB write. This keeps auth, error handling, and persistence simple.
- **JSONB shape storage** — each shape is stored as a single JSON blob, making it trivial to add new shape types without schema changes.
- **Client-side undo/redo** — each user has their own history stack of `{ forward, backward }` operation pairs. Undo emits the inverse operation as a normal write, which broadcasts to other users.
- **In-process WebSocket broadcast** — a single `ConnectionManager` (dict of canvas → set of sockets) handles all rooms. No Redis or external pub/sub needed for a single-server deployment.
- **JWT auth** — stateless token validation on every REST request and on WebSocket connect. Tokens stored in localStorage so they're accessible for the WS `?token=` query param (WebSocket connections can't send custom headers).
