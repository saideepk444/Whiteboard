/**
 * useCursors: tracks remote cursor positions received over WebSocket.
 *
 * updateCursor() is called by useWebSocket whenever a cursor_move message
 * arrives. Each user gets a deterministic color based on their user ID.
 */

import { useState, useCallback } from "react";

export interface RemoteCursor {
  username: string;
  x: number;
  y: number;
  color: string;
}

// Deterministic color from user ID — same user always gets the same color.
function userColor(userId: string): string {
  const palette = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}

export function useCursors(_canvasId: string) {
  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({});

  const updateCursor = useCallback((
    userId: string,
    data: { username: string; x: number; y: number },
  ) => {
    setCursors(prev => ({
      ...prev,
      [userId]: { username: data.username, x: data.x, y: data.y, color: userColor(userId) },
    }));
  }, []);

  return { cursors, updateCursor };
}
