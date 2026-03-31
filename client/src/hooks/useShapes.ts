/**
 * useShapes: owns the local shape array for one canvas.
 *
 * All mutations call the REST API first, then update local state on success.
 * In Phase 4, the WebSocket will also call applyOp() directly when it receives
 * broadcasts from other users — so local state stays in sync from both directions.
 */

import { useState, useCallback } from "react";
import { api } from "../api";

export interface Shape {
  id: string;
  type: "rect" | "ellipse" | "line" | "text";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  text?: string;
  // line endpoints (x,y = start, x2,y2 = end)
  x2?: number;
  y2?: number;
}

export function useShapes(canvasId: string, initial: Shape[]) {
  const [shapes, setShapes] = useState<Shape[]>(initial);

  // Apply an op directly to local state — called by both our own mutations
  // and by the WebSocket handler in Phase 4.
  const applyOp = useCallback((type: string, payload: Shape) => {
    if (type === "shape_add") {
      setShapes(prev => {
        if (prev.find(s => s.id === payload.id)) return prev; // idempotent
        return [...prev, payload];
      });
    } else if (type === "shape_update") {
      setShapes(prev => prev.map(s => s.id === payload.id ? { ...s, ...payload } : s));
    } else if (type === "shape_delete") {
      setShapes(prev => prev.filter(s => s.id !== payload.id));
    }
  }, []);

  async function addShape(shape: Shape): Promise<void> {
    await api.post(`/api/canvases/${canvasId}/shapes`, { id: shape.id, data: shape });
    applyOp("shape_add", shape);
  }

  async function updateShape(shape: Shape): Promise<void> {
    await api.patch(`/api/canvases/${canvasId}/shapes/${shape.id}`, { data: shape });
    applyOp("shape_update", shape);
  }

  async function deleteShape(id: string): Promise<void> {
    await api.delete(`/api/canvases/${canvasId}/shapes/${id}`);
    applyOp("shape_delete", { id } as Shape);
  }

  return { shapes, setShapes, applyOp, addShape, updateShape, deleteShape };
}
