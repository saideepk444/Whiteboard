/**
 * useWebSocket: connects to /ws/{canvasId}?token=...
 *
 * Receives broadcast ops from the server:
 *   shape_add / shape_update / shape_delete → dispatched to applyOp
 *   cursor_move → dispatched to onCursorMove
 *
 * Exposes sendCursor() for emitting cursor positions to the server.
 */

import { useEffect, useRef, useCallback } from "react";
import { getAuth } from "../api";
import { Shape } from "./useShapes";

interface Props {
  canvasId: string;
  applyOp: (type: string, payload: Shape) => void;
  onCursorMove?: (userId: string, data: { username: string; x: number; y: number }) => void;
}

export function useWebSocket({ canvasId, applyOp, onCursorMove }: Props) {
  const wsRef = useRef<WebSocket | null>(null);
  const auth = getAuth();

  // Keep stable refs so message handler always uses latest callbacks
  // without needing to re-create the WebSocket.
  const applyOpRef = useRef(applyOp);
  const onCursorMoveRef = useRef(onCursorMove);
  applyOpRef.current = applyOp;
  onCursorMoveRef.current = onCursorMove;

  useEffect(() => {
    if (!auth) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws/${canvasId}?token=${auth.token}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, payload } = msg;
        if (type === "shape_add" || type === "shape_update" || type === "shape_delete") {
          // Skip ops we sent ourselves — the server echoes to all including sender.
          if (payload.updated_by === auth.userId) return;
          applyOpRef.current(type, payload);
        } else if (type === "cursor_move") {
          onCursorMoveRef.current?.(payload.user_id, {
            username: payload.username,
            x: payload.x,
            y: payload.y,
          });
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => {};
    ws.onclose = () => {};

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [canvasId]); // reconnect only if canvas changes

  const sendCursor = useCallback((x: number, y: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "cursor_move", payload: { x, y } }));
  }, []);

  return { sendCursor };
}
