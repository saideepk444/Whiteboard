import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_pool
from app.routes.canvases import assert_member
from app.routes.users import get_current_user
from app.ws import manager

router = APIRouter(prefix="/api/canvases/{canvas_id}/shapes")


class ShapeBody(BaseModel):
    id: str        # client-generated UUID
    data: dict     # { type, x, y, width, height, color, text, points, ... }


class ShapeUpdateBody(BaseModel):
    data: dict


@router.post("", status_code=201)
async def create_shape(canvas_id: str, body: ShapeBody, user=Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await assert_member(canvas_id, user["sub"], conn)
        await conn.execute(
            """
            INSERT INTO shapes (id, canvas_id, data, created_by)
            VALUES ($1, $2, $3::jsonb, $4)
            ON CONFLICT (id) DO NOTHING
            """,
            body.id, canvas_id, json.dumps(body.data), user["sub"],
        )
    await manager.broadcast(canvas_id, json.dumps({
        "type": "shape_add",
        "payload": {**body.data, "id": body.id, "updated_by": user["sub"]},
    }))
    return {"ok": True}


@router.patch("/{shape_id}")
async def update_shape(canvas_id: str, shape_id: str, body: ShapeUpdateBody, user=Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await assert_member(canvas_id, user["sub"], conn)
        result = await conn.execute(
            """
            UPDATE shapes SET data = $1::jsonb, updated_at = now()
            WHERE id = $2 AND canvas_id = $3
            """,
            json.dumps(body.data), shape_id, canvas_id,
        )
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Shape not found")
    await manager.broadcast(canvas_id, json.dumps({
        "type": "shape_update",
        "payload": {**body.data, "id": shape_id, "updated_by": user["sub"]},
    }))
    return {"ok": True}


@router.delete("/{shape_id}", status_code=204)
async def delete_shape(canvas_id: str, shape_id: str, user=Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await assert_member(canvas_id, user["sub"], conn)
        await conn.execute(
            "DELETE FROM shapes WHERE id = $1 AND canvas_id = $2",
            shape_id, canvas_id,
        )
    await manager.broadcast(canvas_id, json.dumps({
        "type": "shape_delete",
        "payload": {"id": shape_id, "updated_by": user["sub"]},
    }))
