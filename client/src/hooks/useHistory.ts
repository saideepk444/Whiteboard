/**
 * useHistory: per-user client-side undo/redo stack.
 *
 * Each entry stores { op, inverseOp } so we can replay or reverse any action.
 * Undo pops the stack and emits the inverse op. Redo re-applies the original.
 */

import { useRef, useCallback } from "react";
import { Shape } from "./useShapes";

type HistoryEntry = {
  forward: () => Promise<void>;
  backward: () => Promise<void>;
};

export function useHistory({ addShape, updateShape, deleteShape }: {
  shapes: Shape[];  // kept in signature for symmetry with useShapes return value
  addShape: (s: Shape) => Promise<void>;
  updateShape: (s: Shape) => Promise<void>;
  deleteShape: (id: string) => Promise<void>;
}) {
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);

  // Store stable refs to the latest functions so closures inside history
  // entries always call the current version without needing to re-create entries.
  const addRef = useRef(addShape);
  const updateRef = useRef(updateShape);
  const deleteRef = useRef(deleteShape);
  addRef.current = addShape;
  updateRef.current = updateShape;
  deleteRef.current = deleteShape;

  // pushHistory is stable (no deps that change) — each entry closes over
  // the ref wrappers, so it always calls the latest function.
  const pushHistory = useCallback((
    opType: "add" | "update" | "delete",
    before: Shape,
    after?: Shape,
  ) => {
    let entry: HistoryEntry;
    if (opType === "add") {
      entry = {
        forward:  () => addRef.current(before),
        backward: () => deleteRef.current(before.id),
      };
    } else if (opType === "delete") {
      entry = {
        forward:  () => deleteRef.current(before.id),
        backward: () => addRef.current(before),
      };
    } else {
      const prev = { ...before };
      const next = { ...after! };
      entry = {
        forward:  () => updateRef.current(next),
        backward: () => updateRef.current(prev),
      };
    }
    undoStack.current.push(entry);
    redoStack.current = [];
  }, []);

  const undo = useCallback(async () => {
    const entry = undoStack.current.pop();
    if (!entry) return;
    await entry.backward();
    redoStack.current.push(entry);
  }, []);

  const redo = useCallback(async () => {
    const entry = redoStack.current.pop();
    if (!entry) return;
    await entry.forward();
    undoStack.current.push(entry);
  }, []);

  return { pushHistory, undo, redo };
}
