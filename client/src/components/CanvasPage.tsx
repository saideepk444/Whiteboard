/**
 * CanvasPage: the full drawing surface for one canvas.
 *
 * How drawing works:
 *   mousedown → record start point, set "drawing" state
 *   mousemove → update a "draft" shape (shown live but not saved yet)
 *   mouseup   → commit the draft via addShape (REST + local state)
 *
 * The SVG element is like a 2D coordinate system. Each shape is a child element.
 * SVG uses the same coordinate system as screen pixels: (0,0) top-left, x right, y down.
 */

import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useShapes, Shape } from "../hooks/useShapes";
import { useHistory } from "../hooks/useHistory";
import Toolbar, { Tool } from "./Toolbar";
import Cursors from "./Cursors";
import { useWebSocket } from "../hooks/useWebSocket";
import { useCursors } from "../hooks/useCursors";

interface Props {
  canvasId: string;
  onBack: () => void;
}

function randomId() {
  return crypto.randomUUID();
}

function normalizeRect(x1: number, y1: number, x2: number, y2: number) {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

export default function CanvasPage({ canvasId, onBack }: Props) {
  const [canvasName, setCanvasName] = useState("Canvas");
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState("#1e40af");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState("");

  // Drag state for moving/resizing selected shapes
  const dragRef = useRef<{
    type: "move" | "resize";
    startX: number; startY: number;
    origShape: Shape;
    handle?: string;
  } | null>(null);

  // Drawing state
  const drawRef = useRef<{ startX: number; startY: number } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  const [loaded, setLoaded] = useState(false);
  // Track where the user clicked when placing a text shape
  const [textAnchor, setTextAnchor] = useState({ x: 100, y: 100 });

  const { shapes, setShapes, applyOp, addShape, updateShape, deleteShape } = useShapes(canvasId, []);

  // Load initial state from REST. We call setShapes directly because useState's
  // initial value argument is only read on the first render — by then the API
  // hasn't responded yet, so we can't pass it as the initial value.
  useEffect(() => {
    api.get<{ name: string; shapes: { id: string; data: Shape }[] }>(`/api/canvases/${canvasId}`)
      .then(res => {
        setCanvasName(res.name);
        setShapes(res.shapes.map(s => ({ ...s.data, id: s.id })));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [canvasId]);
  const { pushHistory, undo, redo } = useHistory({ shapes, addShape, updateShape, deleteShape });

  // WebSocket for real-time sync
  const { cursors, updateCursor } = useCursors(canvasId);
  const { sendCursor } = useWebSocket({ canvasId, applyOp, onCursorMove: updateCursor });

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
          const shape = shapes.find(s => s.id === selectedId);
          if (shape) {
            pushHistory("delete", shape);
            deleteShape(selectedId);
            setSelectedId(null);
          }
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, shapes, undo, redo, deleteShape, pushHistory]);

  function getSVGPoint(e: React.MouseEvent): { x: number; y: number } {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // -------------------------------------------------------------------------
  // Mouse handlers
  // -------------------------------------------------------------------------

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;

    // If a text edit is in progress, commit it and consume this click.
    // This avoids the onBlur-fires-immediately bug (SVG click steals focus).
    if (editingTextId) {
      commitText(editingTextId);
      return;
    }

    const pt = getSVGPoint(e);

    if (tool === "select") {
      // Hit test: find topmost shape under cursor (reverse order = top first)
      const hit = [...shapes].reverse().find(s => hitTest(s, pt.x, pt.y));
      if (hit) {
        setSelectedId(hit.id);
        dragRef.current = { type: "move", startX: pt.x, startY: pt.y, origShape: { ...hit } };
      } else {
        setSelectedId(null);
      }
      return;
    }

    // Drawing a new shape
    drawRef.current = { startX: pt.x, startY: pt.y };
    const id = randomId();
    if (tool === "text") {
      setTextAnchor({ x: pt.x, y: pt.y });
      setEditingTextId(id);
      setEditingTextValue("");
      drawRef.current = null;
      return;
    }
    const base: Shape = { id, type: tool, x: pt.x, y: pt.y, width: 0, height: 0, color };
    setDraft(base);
  }

  function onMouseMove(e: React.MouseEvent) {
    const pt = getSVGPoint(e);
    sendCursor(pt.x, pt.y);

    // Update draft shape while drawing
    if (drawRef.current && draft) {
      const { startX, startY } = drawRef.current;
      if (draft.type === "line") {
        setDraft({ ...draft, x: startX, y: startY, x2: pt.x, y2: pt.y });
      } else {
        const norm = normalizeRect(startX, startY, pt.x, pt.y);
        setDraft({ ...draft, ...norm });
      }
      return;
    }

    // Move selected shape
    if (dragRef.current?.type === "move") {
      const { startX, startY, origShape } = dragRef.current;
      const dx = pt.x - startX;
      const dy = pt.y - startY;
      if (origShape.type === "line") {
        applyOp("shape_update", {
          ...origShape,
          x: origShape.x + dx, y: origShape.y + dy,
          x2: (origShape.x2 ?? origShape.x) + dx,
          y2: (origShape.y2 ?? origShape.y) + dy,
        });
      } else {
        applyOp("shape_update", { ...origShape, x: origShape.x + dx, y: origShape.y + dy });
      }
    }

    // Resize selected shape
    if (dragRef.current?.type === "resize") {
      const { startX, startY, origShape, handle } = dragRef.current;
      const dx = pt.x - startX;
      const dy = pt.y - startY;
      let updated = { ...origShape };
      if (handle === "se") {
        updated.width = Math.max(8, origShape.width + dx);
        updated.height = Math.max(8, origShape.height + dy);
      } else if (handle === "sw") {
        updated.x = origShape.x + dx;
        updated.width = Math.max(8, origShape.width - dx);
        updated.height = Math.max(8, origShape.height + dy);
      } else if (handle === "ne") {
        updated.y = origShape.y + dy;
        updated.width = Math.max(8, origShape.width + dx);
        updated.height = Math.max(8, origShape.height - dy);
      } else if (handle === "nw") {
        updated.x = origShape.x + dx;
        updated.y = origShape.y + dy;
        updated.width = Math.max(8, origShape.width - dx);
        updated.height = Math.max(8, origShape.height - dy);
      } else if (handle === "p1") {
        updated.x = origShape.x + dx;
        updated.y = origShape.y + dy;
      } else if (handle === "p2") {
        updated.x2 = (origShape.x2 ?? origShape.x) + dx;
        updated.y2 = (origShape.y2 ?? origShape.y) + dy;
      }
      applyOp("shape_update", updated);
    }
  }

  function onMouseUp(_e: React.MouseEvent) {
    // Commit a drawn shape
    if (drawRef.current && draft) {
      const minSize = draft.type === "line" ? 4 : 4;
      const big = draft.type === "line"
        ? Math.hypot((draft.x2 ?? draft.x) - draft.x, (draft.y2 ?? draft.y) - draft.y) > minSize
        : draft.width > minSize && draft.height > minSize;

      if (big) {
        pushHistory("add", draft);
        addShape(draft);
      }
      setDraft(null);
    }

    // Commit a move/resize
    if (dragRef.current) {
      const current = shapes.find(s => s.id === dragRef.current!.origShape.id);
      if (current) {
        const orig = dragRef.current.origShape;
        const moved = current.x !== orig.x || current.y !== orig.y
          || current.width !== orig.width || current.height !== orig.height;
        if (moved) {
          pushHistory("update", orig, current);
          updateShape(current);
        }
      }
    }

    drawRef.current = null;
    dragRef.current = null;
  }

  function commitText(id: string) {
    if (!editingTextValue.trim()) {
      setEditingTextId(null);
      return;
    }
    const existing = shapes.find(s => s.id === id);
    const shape: Shape = {
      id,
      type: "text",
      x: existing ? existing.x : textAnchor.x,
      y: existing ? existing.y : textAnchor.y,
      width: existing ? existing.width : 200,
      height: existing ? existing.height : 24,
      color: existing ? existing.color : color,
      text: editingTextValue,
    };
    if (existing) {
      pushHistory("update", existing, shape);
      updateShape(shape);
    } else {
      pushHistory("add", shape);
      addShape(shape);
    }
    setEditingTextId(null);
    setEditingTextValue("");
  }

  function startResize(e: React.MouseEvent, shape: Shape, handle: string) {
    e.stopPropagation();
    const pt = getSVGPoint(e);
    dragRef.current = { type: "resize", startX: pt.x, startY: pt.y, origShape: { ...shape }, handle };
  }

  if (!loaded) {
    return <div style={{ padding: 32, color: "#888" }}>Loading...</div>;
  }

  const selectedShape = shapes.find(s => s.id === selectedId);

  return (
    <div style={styles.page}>
      <Toolbar
        tool={tool}
        color={color}
        onToolChange={t => { setTool(t); setSelectedId(null); }}
        onColorChange={c => {
          setColor(c);
          if (selectedShape) {
            const updated = { ...selectedShape, color: c };
            pushHistory("update", selectedShape, updated);
            updateShape(updated);
          }
        }}
        onBack={onBack}
        canvasName={canvasName}
        onUndo={undo}
        onRedo={redo}
      />

      <div style={styles.canvasWrap}>
        <svg
          ref={svgRef}
          style={{ ...styles.svg, cursor: tool === "select" ? "default" : "crosshair" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onDoubleClick={(e) => {
            const pt = getSVGPoint(e);
            const hit = [...shapes].reverse().find(s => s.type === "text" && hitTest(s, pt.x, pt.y));
            if (hit) {
              setTextAnchor({ x: hit.x, y: hit.y });
              setEditingTextId(hit.id);
              setEditingTextValue(hit.text ?? "");
              setSelectedId(null);
            }
          }}
        >
          {/* Render committed shapes — text last so it always appears on top.
              Skip the shape currently being edited so the input takes its place. */}
          {[...shapes.filter(s => s.type !== "text"), ...shapes.filter(s => s.type === "text")].filter(s => s.id !== editingTextId).map(s => (
            <ShapeEl
              key={s.id}
              shape={s}
              selected={s.id === selectedId}
              onResizeHandle={(e, h) => startResize(e, s, h)}
            />
          ))}

          {/* Render draft (in-progress draw) */}
          {draft && <ShapeEl shape={draft} selected={false} onResizeHandle={() => {}} />}

          {/* Remote cursors overlay */}
          <Cursors cursors={cursors} />
        </svg>

        {/* Floating text input when adding a text shape — positioned where the user clicked */}
        {editingTextId && (
          <div style={{ ...styles.textInputWrap, left: textAnchor.x, top: textAnchor.y }}>
            <input
              autoFocus
              style={{ ...styles.textInput, color }}
              placeholder="Type and press Enter"
              value={editingTextValue}
              onChange={e => setEditingTextValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") commitText(editingTextId);
                if (e.key === "Escape") setEditingTextId(null);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// ShapeEl: renders a single shape + selection handles
// -------------------------------------------------------------------------

function ShapeEl({
  shape,
  selected,
  onResizeHandle,
}: {
  shape: Shape;
  selected: boolean;
  onResizeHandle: (e: React.MouseEvent, handle: string) => void;
}) {
  const strokeWidth = 2;
  const fill = shape.type === "line" || shape.type === "text" ? "none" : shape.color + "33"; // 20% opacity fill
  const stroke = shape.color;

  let el: React.ReactNode;
  if (shape.type === "rect") {
    el = <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  } else if (shape.type === "ellipse") {
    el = <ellipse cx={shape.x + shape.width / 2} cy={shape.y + shape.height / 2} rx={shape.width / 2} ry={shape.height / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  } else if (shape.type === "line") {
    el = <line x1={shape.x} y1={shape.y} x2={shape.x2 ?? shape.x} y2={shape.y2 ?? shape.y} stroke={stroke} strokeWidth={strokeWidth + 1} strokeLinecap="round" />;
  } else if (shape.type === "text") {
    // fontSize = height so resizing the shape changes the font size.
    // Baseline at y + height*0.8 keeps the glyph body inside the bounding box.
    el = <text x={shape.x} y={shape.y + shape.height * 0.8} fill={shape.color} fontSize={shape.height} fontFamily="sans-serif">{shape.text}</text>;
  }

  // Endpoint handles for lines
  const lineHandles = selected && shape.type === "line" ? (
    <>
      {([["p1", shape.x, shape.y], ["p2", shape.x2 ?? shape.x, shape.y2 ?? shape.y]] as const).map(([h, hx, hy]) => (
        <rect
          key={h}
          x={hx - 5} y={hy - 5}
          width={10} height={10}
          fill="#fff" stroke="#2563eb" strokeWidth={1.5}
          style={{ cursor: "crosshair" }}
          onMouseDown={e => onResizeHandle(e, h)}
        />
      ))}
    </>
  ) : null;

  // Selection handles at four corners
  const handles = selected && shape.type !== "line" ? (
    <>
      {[["nw", shape.x, shape.y], ["ne", shape.x + shape.width, shape.y],
        ["sw", shape.x, shape.y + shape.height], ["se", shape.x + shape.width, shape.y + shape.height]
      ].map(([h, hx, hy]) => (
        <rect
          key={h as string}
          x={(hx as number) - 5} y={(hy as number) - 5}
          width={10} height={10}
          fill="#fff" stroke="#2563eb" strokeWidth={1.5}
          style={{ cursor: "nwse-resize" }}
          onMouseDown={e => onResizeHandle(e, h as string)}
        />
      ))}
    </>
  ) : null;

  // For lines, compute the bounding box from the two endpoints.
  const lineBBox = shape.type === "line" ? {
    x: Math.min(shape.x, shape.x2 ?? shape.x),
    y: Math.min(shape.y, shape.y2 ?? shape.y),
    w: Math.abs((shape.x2 ?? shape.x) - shape.x),
    h: Math.abs((shape.y2 ?? shape.y) - shape.y),
  } : null;

  return (
    <g>
      {el}
      {selected && shape.type !== "line" && (
        <rect
          x={shape.x - 2} y={shape.y - 2}
          width={shape.width + 4} height={shape.height + 4}
          fill="none" stroke="#2563eb" strokeWidth={1} strokeDasharray="4 2"
        />
      )}
      {selected && lineBBox && (
        <rect
          x={lineBBox.x - 4} y={lineBBox.y - 4}
          width={lineBBox.w + 8} height={lineBBox.h + 8}
          fill="none" stroke="#2563eb" strokeWidth={1} strokeDasharray="4 2"
        />
      )}
      {handles}
      {lineHandles}
    </g>
  );
}

// -------------------------------------------------------------------------
// Hit testing: is point (px, py) inside shape?
// -------------------------------------------------------------------------

function hitTest(shape: Shape, px: number, py: number): boolean {
  if (shape.type === "line") {
    // Point-to-line-segment distance < threshold
    const dx = (shape.x2 ?? shape.x) - shape.x;
    const dy = (shape.y2 ?? shape.y) - shape.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return false;
    const t = Math.max(0, Math.min(1, ((px - shape.x) * dx + (py - shape.y) * dy) / len2));
    const nx = shape.x + t * dx - px;
    const ny = shape.y + t * dy - py;
    return Math.sqrt(nx * nx + ny * ny) < 8;
  }
  return px >= shape.x && px <= shape.x + shape.width && py >= shape.y && py <= shape.y + shape.height;
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" },
  canvasWrap: { flex: 1, position: "relative", overflow: "hidden", background: "#fafafa" },
  svg: { width: "100%", height: "100%", display: "block" },
  textInputWrap: {
    position: "absolute",
    zIndex: 10,
  },
  textInput: {
    fontSize: 18, border: "none", borderBottom: "2px solid #2563eb",
    outline: "none", background: "transparent", minWidth: 200, padding: "4px 0",
  },
};
