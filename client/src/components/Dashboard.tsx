import { useEffect, useState } from "react";
import { api } from "../api";
import InviteModal from "./InviteModal";
import CopyCanvasModal from "./CopyCanvasModal";

interface Canvas {
  id: string;
  name: string;
  owner_id: string;
}

interface Props {
  onOpenCanvas: (id: string) => void;
  onLogout: () => void;
  username: string;
}

export default function Dashboard({ onOpenCanvas, onLogout, username }: Props) {
  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviteCanvasId, setInviteCanvasId] = useState<string | null>(null);
  const [copyCanvas, setCopyCanvas] = useState<Canvas | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Canvas[]>("/api/canvases").then(setCanvases).catch(() => {});
  }, []);

  async function handleCopy(name: string, copyMembers: boolean) {
    if (!copyCanvas) return;
    try {
      const newCanvas = await api.post<Canvas>(`/api/canvases/${copyCanvas.id}/copy`, { name, copy_members: copyMembers });
      setCanvases(prev => [newCanvas, ...prev]);
      setCopyCanvas(null);
      onOpenCanvas(newCanvas.id);
    } catch (err: any) {
      setError(err.message);
      setCopyCanvas(null);
    }
  }

  async function createCanvas(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const canvas = await api.post<Canvas>("/api/canvases", { name: newName.trim() });
      setCanvases(prev => [canvas, ...prev]);
      setNewName("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <span style={styles.brand}>Whiteboard</span>
        <div style={styles.headerRight}>
          <span style={styles.username}>{username}</span>
          <button style={styles.logoutBtn} onClick={onLogout}>Log out</button>
        </div>
      </div>

      <div style={styles.body}>
        <h2 style={styles.heading}>Your canvases</h2>

        <form onSubmit={createCanvas} style={styles.createRow}>
          <input
            style={styles.input}
            placeholder="New canvas name..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <button style={styles.createBtn} type="submit" disabled={creating}>
            {creating ? "..." : "Create"}
          </button>
        </form>

        {error && <p style={styles.error}>{error}</p>}

        {canvases.length === 0 && (
          <p style={styles.empty}>No canvases yet. Create one above.</p>
        )}

        <div style={styles.grid}>
          {canvases.map(c => (
            <div key={c.id} style={styles.card}>
              <span style={styles.cardName}>{c.name}</span>
              <div style={styles.cardActions}>
                <button style={styles.openBtn} onClick={() => onOpenCanvas(c.id)}>Open</button>
                <button style={styles.inviteBtn} onClick={() => setInviteCanvasId(c.id)}>Invite</button>
                <button style={styles.inviteBtn} onClick={() => setCopyCanvas(c)}>Copy</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {inviteCanvasId && (
        <InviteModal
          canvasId={inviteCanvasId}
          onClose={() => setInviteCanvasId(null)}
        />
      )}

      {copyCanvas && (
        <CopyCanvasModal
          sourceName={copyCanvas.name}
          onConfirm={handleCopy}
          onClose={() => setCopyCanvas(null)}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f4f4f5", display: "flex", flexDirection: "column" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 32px", height: 56, background: "#18181b", color: "#fff",
  },
  brand: { fontWeight: 700, fontSize: 16 },
  headerRight: { display: "flex", alignItems: "center", gap: 16 },
  username: { fontSize: 14, color: "#a1a1aa" },
  logoutBtn: {
    background: "none", border: "1px solid #52525b", color: "#fff",
    borderRadius: 4, padding: "4px 12px", cursor: "pointer", fontSize: 13,
  },
  body: { padding: 32, maxWidth: 720, margin: "0 auto", width: "100%" },
  heading: { margin: "0 0 20px", fontSize: 20, fontWeight: 600 },
  createRow: { display: "flex", gap: 8, marginBottom: 24 },
  input: {
    flex: 1, padding: "8px 12px", border: "1px solid #ddd",
    borderRadius: 4, fontSize: 14,
  },
  createBtn: {
    padding: "8px 20px", background: "#18181b", color: "#fff",
    border: "none", borderRadius: 4, cursor: "pointer", fontSize: 14,
  },
  empty: { color: "#888", fontSize: 14 },
  error: { color: "#dc2626", fontSize: 13 },
  grid: { display: "flex", flexDirection: "column", gap: 8 },
  card: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "#fff", borderRadius: 6, padding: "14px 16px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  cardName: { fontWeight: 500, fontSize: 15 },
  cardActions: { display: "flex", gap: 8 },
  openBtn: {
    padding: "6px 14px", background: "#18181b", color: "#fff",
    border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13,
  },
  inviteBtn: {
    padding: "6px 14px", background: "none", color: "#18181b",
    border: "1px solid #ddd", borderRadius: 4, cursor: "pointer", fontSize: 13,
  },
};
