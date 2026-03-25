# CLAUDE.md

## Stack
- Frontend: React 19 + TypeScript + Vite (client/)
- Backend: FastAPI + asyncpg (server/app/)
- DB: PostgreSQL 16, schema in server/schema.sql
- Real-time: WebSocket on /ws
- Do not swap frameworks or database; packages can be added freely

## Running the project
```
docker compose up --build
```
- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Vite proxies /api and /ws to backend

## Auth
- JWT tokens (python-jose or similar), signed with a secret key
- Stored in localStorage on the client
- REST requests: Authorization: Bearer <token> header
- WebSocket auth: /ws/<canvas_id>?token=<token> query param (validated on connect)

## Architecture decisions

### Real-time sync
- WebSocket is broadcast-only — clients send operations via REST, server broadcasts via WS
- On canvas join, client receives full current state via REST (GET /api/canvases/:id), then WS keeps it live
- Each WS message is a JSON operation: `{ type, payload, user_id, op_id }`

### Operation types
- `shape_add`, `shape_update`, `shape_delete` — shape lifecycle
- `cursor_move` — ephemeral cursor position (not persisted)
- `canvas_state` — full state snapshot sent on join

### Undo/redo
- Client-side operation stack per user
- Undo emits an inverse operation (e.g. move back, restore deleted shape)
- Server treats undo/redo as normal operations and broadcasts them

### Conflict handling
- Last-write-wins per shape property (timestamp-based)
- Good enough for the 2-5 person synchronous use case; no CRDT needed

### Shapes
- Stored as JSONB in DB: `{ id, type, x, y, width, height, color, text, points }`
- Types: rectangle, ellipse, line, text
- Shape IDs are client-generated UUIDs

## DB conventions
- Use asyncpg directly — no ORM
- All queries live in server/app/ (colocated with routes)
- All tables defined in server/schema.sql

## Key tables (to be created in schema.sql)
- `users` — id, username, email, password_hash, created_at
- `canvases` — id, name, owner_id, created_at, updated_at
- `canvas_members` — canvas_id, user_id, invited_by, joined_at
- `shapes` — id, canvas_id, data (JSONB), created_by, created_at, updated_at

## File layout conventions
- REST routes: server/app/routes/<resource>.py
- WS manager: server/app/ws.py (ConnectionManager class)
- Client components: client/src/components/
- Client hooks: client/src/hooks/
- Client API calls: client/src/api.ts
