import { useState } from "react";

interface Props {
  sourceName: string;
  onConfirm: (name: string, copyMembers: boolean) => void;
  onClose: () => void;
}

export default function CopyCanvasModal({ sourceName, onConfirm, onClose }: Props) {
  const [name, setName] = useState(`${sourceName} (copy)`);
  const [copyMembers, setCopyMembers] = useState(true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onConfirm(name.trim(), copyMembers);
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={styles.title}>Copy canvas</h3>
        <form onSubmit={handleSubmit}>
          <label style={styles.label}>New name</label>
          <input
            autoFocus
            style={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <label style={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={copyMembers}
              onChange={e => setCopyMembers(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Share with the same people
          </label>
          <div style={styles.buttons}>
            <button type="button" style={styles.cancel} onClick={onClose}>Cancel</button>
            <button type="submit" style={styles.confirm}>Create copy</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
  },
  modal: {
    background: "#18181b", borderRadius: 8, padding: 24, width: 360,
    border: "1px solid #3f3f46",
  },
  title: { margin: "0 0 16px", color: "#fff", fontSize: 16 },
  label: { display: "block", color: "#a1a1aa", fontSize: 13, marginBottom: 6 },
  input: {
    width: "100%", padding: "8px 10px", borderRadius: 4, fontSize: 14,
    background: "#27272a", border: "1px solid #3f3f46", color: "#fff",
    boxSizing: "border-box", marginBottom: 14,
  },
  checkboxRow: {
    display: "flex", alignItems: "center", color: "#a1a1aa",
    fontSize: 13, marginBottom: 20, cursor: "pointer",
  },
  buttons: { display: "flex", justifyContent: "flex-end", gap: 8 },
  cancel: {
    padding: "7px 16px", background: "none", border: "1px solid #3f3f46",
    borderRadius: 4, color: "#a1a1aa", cursor: "pointer", fontSize: 13,
  },
  confirm: {
    padding: "7px 16px", background: "#2563eb", border: "none",
    borderRadius: 4, color: "#fff", cursor: "pointer", fontSize: 13,
  },
};
