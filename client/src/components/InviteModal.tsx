import { useState } from "react";
import { api } from "../api";

interface Props {
  canvasId: string;
  onClose: () => void;
}

export default function InviteModal({ canvasId, onClose }: Props) {
  const [identifier, setIdentifier] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      await api.post(`/api/canvases/${canvasId}/invite`, { identifier: identifier.trim() });
      setStatus("success");
      setMessage(`Invited ${identifier}`);
      setIdentifier("");
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message);
    }
  }

  return (
    // Backdrop: clicking outside closes the modal
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 style={styles.title}>Invite to canvas</h3>
        <form onSubmit={submit} style={styles.form}>
          <input
            style={styles.input}
            placeholder="Username or email"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            required
            autoFocus
          />
          <div style={styles.actions}>
            <button style={styles.cancelBtn} type="button" onClick={onClose}>Cancel</button>
            <button style={styles.inviteBtn} type="submit" disabled={status === "loading"}>
              {status === "loading" ? "..." : "Invite"}
            </button>
          </div>
        </form>
        {message && (
          <p style={{ ...styles.msg, color: status === "error" ? "#dc2626" : "#16a34a" }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
  },
  modal: {
    background: "#fff", borderRadius: 8, padding: 28, width: 360,
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
  },
  title: { margin: "0 0 20px", fontSize: 17, fontWeight: 600 },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  input: { padding: "9px 12px", border: "1px solid #ddd", borderRadius: 4, fontSize: 14 },
  actions: { display: "flex", gap: 8, justifyContent: "flex-end" },
  cancelBtn: {
    padding: "8px 16px", background: "none", border: "1px solid #ddd",
    borderRadius: 4, cursor: "pointer", fontSize: 13,
  },
  inviteBtn: {
    padding: "8px 16px", background: "#18181b", color: "#fff",
    border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13,
  },
  msg: { marginTop: 12, fontSize: 13 },
};
