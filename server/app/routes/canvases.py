import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_pool
from app.routes.users import get_current_user

router = APIRouter(prefix="/api/canvases")


class CreateCanvasRequest(BaseModel):
    name: str


class InviteRequest(BaseModel):
    # Invite by username or email — we try both.
    identifier: str


class CopyCanvasRequest(BaseModel):
    name: str
    copy_members: bool


# ---------------------------------------------------------------------------
# Helper: assert caller is a member of the canvas. Used by canvas + shape routes.
# ---------------------------------------------------------------------------

async def assert_member(canvas_id: str, user_id: str, conn) -> None:
    row = await conn.fetchrow(
        """
        SELECT 1 FROM canvas_members
        WHERE canvas_id = $1 AND user_id = $2
        """,
        canvas_id, user_id,
    )
    if not row:
        raise HTTPException(status_code=403, detail="Not a member of this canvas")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("", status_code=201)
async def create_canvas(body: CreateCanvasRequest, user=Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        canvas = await conn.fetchrow(
            "INSERT INTO canvases (name, owner_id) VALUES ($1, $2) RETURNING id, name, created_at",
            body.name, user["sub"],
        )
        # Also insert owner as a member so membership checks are a single query everywhere.
        await conn.execute(
            "INSERT INTO canvas_members (canvas_id, user_id) VALUES ($1, $2)",
            str(canvas["id"]), user["sub"],
        )
    return {"id": str(canvas["id"]), "name": canvas["name"]}


@router.get("")
async def list_canvases(user=Depends(get_current_user)):
    """Return all canvases the current user owns or is a member of."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT c.id, c.name, c.owner_id, c.created_at
            FROM canvases c
            JOIN canvas_members cm ON cm.canvas_id = c.id
            WHERE cm.user_id = $1
            ORDER BY c.created_at DESC
            """,
            user["sub"],
        )
    return [{"id": str(r["id"]), "name": r["name"], "owner_id": str(r["owner_id"])} for r in rows]


@router.get("/{canvas_id}")
async def get_canvas(canvas_id: str, user=Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await assert_member(canvas_id, user["sub"], conn)
        canvas = await conn.fetchrow(
            "SELECT id, name, owner_id FROM canvases WHERE id = $1", canvas_id
        )
        if not canvas:
            raise HTTPException(status_code=404, detail="Canvas not found")
        shapes = await conn.fetch(
            "SELECT id, data, created_by FROM shapes WHERE canvas_id = $1 ORDER BY created_at",
            canvas_id,
        )
    return {
        "id": str(canvas["id"]),
        "name": canvas["name"],
        "owner_id": str(canvas["owner_id"]),
        "shapes": [{"id": str(s["id"]), "data": json.loads(s["data"]) if isinstance(s["data"], str) else dict(s["data"]), "created_by": str(s["created_by"])} for s in shapes],
    }


@router.post("/{canvas_id}/copy", status_code=201)
async def copy_canvas(canvas_id: str, body: CopyCanvasRequest, user=Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await assert_member(canvas_id, user["sub"], conn)

        # Create the new canvas
        new_canvas = await conn.fetchrow(
            "INSERT INTO canvases (name, owner_id) VALUES ($1, $2) RETURNING id",
            body.name, user["sub"],
        )
        new_id = str(new_canvas["id"])

        # Add caller as member of the new canvas
        await conn.execute(
            "INSERT INTO canvas_members (canvas_id, user_id) VALUES ($1, $2)",
            new_id, user["sub"],
        )

        # Copy all shapes from the source canvas
        await conn.execute(
            """
            INSERT INTO shapes (id, canvas_id, data, created_by)
            SELECT gen_random_uuid(), $1, data, created_by
            FROM shapes WHERE canvas_id = $2
            """,
            new_id, canvas_id,
        )

        # Optionally copy members (skip the caller — already added above)
        if body.copy_members:
            await conn.execute(
                """
                INSERT INTO canvas_members (canvas_id, user_id, invited_by)
                SELECT $1, user_id, $2
                FROM canvas_members
                WHERE canvas_id = $3 AND user_id != $2
                ON CONFLICT DO NOTHING
                """,
                new_id, user["sub"], canvas_id,
            )

    return {"id": new_id, "name": body.name}


@router.post("/{canvas_id}/invite", status_code=201)
async def invite_user(canvas_id: str, body: InviteRequest, user=Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await assert_member(canvas_id, user["sub"], conn)

        # Look up the invitee by username or email.
        invitee = await conn.fetchrow(
            "SELECT id FROM users WHERE username = $1 OR email = $1",
            body.identifier,
        )
        if not invitee:
            raise HTTPException(status_code=404, detail="User not found")

        invitee_id = str(invitee["id"])
        if invitee_id == user["sub"]:
            raise HTTPException(status_code=400, detail="You are already a member")

        # INSERT ... ON CONFLICT DO NOTHING means re-inviting is a no-op.
        await conn.execute(
            """
            INSERT INTO canvas_members (canvas_id, user_id, invited_by)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
            """,
            canvas_id, invitee_id, user["sub"],
        )
    return {"ok": True}
