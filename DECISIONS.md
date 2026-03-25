# Architecture Decisions

---

## JWT stored in localStorage

**What:** Auth tokens are JWTs stored in localStorage, passed as `Authorization: Bearer <token>` on REST and `?token=<token>` on WebSocket.
**Why:** WebSocket connections can't send custom headers — query param is the only viable auth mechanism. localStorage makes this trivial. httpOnly cookies would require a separate WS ticket/handshake system.
**Tradeoff:** Tokens are accessible to JavaScript; vulnerable to XSS token theft. Acceptable for an internal synchronous design tool where the threat model doesn't include untrusted content.

---

## REST for writes, WebSocket for broadcast only

**What:** All mutations (shape add/update/delete, invite) go through REST endpoints. WebSocket is receive-only on the client — the server broadcasts after each successful REST write.
**Why:** Free HTTP semantics (status codes, auth headers, request/response correlation). No custom ack/error protocol needed on top of WS. Trivially debuggable with curl or the browser network tab.
**Tradeoff:** Each write is two round trips as seen by other clients (REST → DB → WS broadcast). Imperceptible for 2–5 users; would matter at high write volume.

---

## Last-write-wins conflict resolution

**What:** Shape updates are full overwrites. The most recent `updated_at` timestamp wins. No CRDT or operational transform.
**Why:** The deployment context is synchronous sessions — users are on a call together. When two people edit the same shape simultaneously, social coordination resolves it ("wait, I'm moving that"). LWW is correct behavior for this use case.
**Tradeoff:** Non-conflicting concurrent edits to the same shape (e.g. User A changes color, User B moves it) can silently drop one change, since the whole shape data blob is overwritten. Fixable by making PATCH granular per-property, but not worth the complexity here.

---

## Client-side per-user undo/redo

**What:** Each client maintains a local stack of `{ op, inverseOp }`. Ctrl+Z pops and emits the inverse operation via REST+WS. The server treats it as a normal write.
**Why:** Server-side undo requires defining semantics for interleaved multi-user operations — the collaborative undo problem, which is hard. Client-side undo means "undo my last action," which matches user expectations and every major whiteboard tool (including Figma).
**Tradeoff:** If User A undoes a move after User B has since moved the same shape, A's undo overwrites B's position. Resolves socially on a call; matches Figma's behavior.

---

## JSONB for shape data

**What:** Shapes are stored as a single `data` JSONB column: `{ id, type, x, y, width, height, color, text, points }`. Shape ID is a client-generated UUID.
**Why:** Different shape types have different attributes. Normalized columns would mean nullable columns everywhere or a complex per-type table scheme. JSONB stores exactly what's needed per type and requires no schema migration to add a new shape type.
**Tradeoff:** No column-level DB constraints or indexes on shape properties. Irrelevant for this access pattern (always loading all shapes for a canvas by canvas_id).

---

## Invite by immediate membership (no email flow)

**What:** Inviting a user looks up their account by username or email and immediately inserts a `canvas_members` row. No invite email, no pending state, no accept/decline flow.
**Why:** The spec says "a simple mechanism is fine." The deployment context is small internal teams — the inviter already knows the invitee's username. An email flow adds infrastructure (SMTP) and UX complexity with no benefit here.
**Tradeoff:** No notification to the invitee; they just see the canvas appear in their dashboard next time they look. No way to invite someone who doesn't have an account yet.

---

## In-process WebSocket broadcast (no pub/sub)

**What:** `ConnectionManager` in `server/app/ws.py` is a module-level singleton — a plain `dict[canvas_id → set[WebSocket]]`. No Redis, no message queue.
**Why:** One server process, one event loop, asyncio is single-threaded. A plain dict has zero concurrency issues and zero infrastructure cost. Broadcast is `asyncio.gather` over all sockets in the room.
**Tradeoff:** State is in RAM only. If the server restarts, all active connections drop (clients reconnect on next action). Doesn't scale to multiple server instances. Fine for a dev/demo deployment.

---

## Server-side cursor identity injection

**What:** Clients send cursor positions as `{ type: "cursor_move", payload: { x, y } }`. The server injects `user_id` and `username` from the validated JWT before forwarding to the room, so clients can't spoof each other's cursors.
**Why:** The client shouldn't be trusted to self-report identity. The JWT is already validated on connect; reusing it to tag cursor messages is free.
**Tradeoff:** Negligible extra serialization work on every cursor event.

---

## Schema initialized at app startup

**What:** The FastAPI lifespan handler reads `schema.sql` and runs it against the DB on every startup (`CREATE TABLE IF NOT EXISTS` is idempotent).
**Why:** Eliminates a separate migration step and avoids Docker startup race conditions where the app starts before the schema exists. Simple and correct for a single-node dev deployment.
**Tradeoff:** Not suitable for production schema migrations (no versioning, no rollback). A real deployment would use Alembic or Flyway.
