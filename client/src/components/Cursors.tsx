/**
 * Cursors: renders remote user cursor positions on the SVG canvas.
 * Phase 3 stub — renders nothing. Filled in Phase 4.
 */

import { RemoteCursor } from "../hooks/useCursors";

interface Props {
  cursors: Record<string, RemoteCursor>;
}

export default function Cursors({ cursors }: Props) {
  return (
    <>
      {Object.entries(cursors).map(([userId, cursor]) => (
        <g key={userId}>
          {/* Simple crosshair cursor with username label */}
          <circle cx={cursor.x} cy={cursor.y} r={5} fill={cursor.color} opacity={0.8} />
          <text x={cursor.x + 8} y={cursor.y - 4} fontSize={12} fill={cursor.color} fontFamily="sans-serif">
            {cursor.username}
          </text>
        </g>
      ))}
    </>
  );
}
