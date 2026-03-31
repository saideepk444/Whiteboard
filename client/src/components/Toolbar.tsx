export type Tool = "select" | "rect" | "ellipse" | "line" | "text";

interface Props {
  tool: Tool;
  color: string;
  onToolChange: (t: Tool) => void;
  onColorChange: (c: string) => void;
  onBack: () => void;
  canvasName: string;
  onUndo: () => void;
  onRedo: () => void;
}

const TOOLS: { id: Tool; label: string }[] = [
  { id: "select", label: "Select" },
  { id: "rect",   label: "Rect" },
  { id: "ellipse",label: "Ellipse" },
  { id: "line",   label: "Line" },
  { id: "text",   label: "Text" },
];

export default function Toolbar({ tool, color, onToolChange, onColorChange, onBack, canvasName, onUndo, onRedo }: Props) {
  return (
    <div style={styles.bar}>
      <button style={styles.back} onClick={onBack}>← Back</button>
      <span style={styles.name}>{canvasName}</span>
      <div style={styles.tools}>
        {TOOLS.map(t => (
          <button
            key={t.id}
            style={tool === t.id ? styles.activeTool : styles.toolBtn}
            onClick={() => onToolChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={styles.tools}>
        <button style={styles.toolBtn} onClick={onUndo} title="Undo (Ctrl+Z)">↩ Undo</button>
        <button style={styles.toolBtn} onClick={onRedo} title="Redo (Ctrl+Shift+Z)">↪ Redo</button>
      </div>
      <input
        type="color"
        value={color}
        onChange={e => onColorChange(e.target.value)}
        style={styles.colorPicker}
        title="Color"
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "0 16px", height: 48, background: "#18181b",
    borderBottom: "1px solid #27272a", flexShrink: 0,
  },
  back: {
    background: "none", border: "none", color: "#a1a1aa",
    cursor: "pointer", fontSize: 13, padding: "4px 8px",
  },
  name: { color: "#fff", fontSize: 14, fontWeight: 500, marginRight: 8 },
  tools: { display: "flex", gap: 4 },
  toolBtn: {
    padding: "5px 12px", background: "none", border: "1px solid #3f3f46",
    borderRadius: 4, color: "#a1a1aa", cursor: "pointer", fontSize: 13,
  },
  activeTool: {
    padding: "5px 12px", background: "#3f3f46", border: "1px solid #52525b",
    borderRadius: 4, color: "#fff", cursor: "pointer", fontSize: 13,
  },
  colorPicker: {
    width: 32, height: 32, border: "none", borderRadius: 4,
    cursor: "pointer", background: "none", padding: 0, marginLeft: 8,
  },
};
