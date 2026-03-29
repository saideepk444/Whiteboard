import { useState } from "react";
import { api, saveAuth } from "../api";

interface Props {
  onAuth: () => void;
}

export default function AuthPage({ onAuth }: Props) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();  // prevent default browser form submission (page reload)
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        const res = await api.post<{ token: string; user_id: string; username: string }>(
          "/api/auth/signup",
          { username, email, password }
        );
        saveAuth(res.token, res.user_id, res.username);
      } else {
        const res = await api.post<{ token: string; user_id: string; username: string }>(
          "/api/auth/login",
          { email, password }
        );
        saveAuth(res.token, res.user_id, res.username);
      }
      onAuth();  // tell App.tsx we're now authenticated
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Whiteboard</h1>
        <div style={styles.tabs}>
          <button
            style={mode === "login" ? styles.activeTab : styles.tab}
            onClick={() => setMode("login")}
          >
            Log in
          </button>
          <button
            style={mode === "signup" ? styles.activeTab : styles.tab}
            onClick={() => setMode("signup")}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={submit} style={styles.form}>
          {mode === "signup" && (
            <input
              style={styles.input}
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          )}
          <input
            style={styles.input}
            placeholder="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            style={styles.input}
            placeholder="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.submit} type="submit" disabled={loading}>
            {loading ? "..." : mode === "login" ? "Log in" : "Sign up"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: "flex", alignItems: "center", justifyContent: "center",
    height: "100vh", background: "#f4f4f5",
  },
  card: {
    background: "#fff", borderRadius: 8, padding: 32,
    width: 340, boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
  },
  title: { margin: "0 0 24px", fontSize: 22, fontWeight: 700 },
  tabs: { display: "flex", marginBottom: 20, gap: 8 },
  tab: {
    flex: 1, padding: "8px 0", background: "none",
    border: "1px solid #ddd", borderRadius: 4, cursor: "pointer", color: "#666",
  },
  activeTab: {
    flex: 1, padding: "8px 0", background: "#18181b",
    border: "1px solid #18181b", borderRadius: 4, cursor: "pointer", color: "#fff",
  },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  input: {
    padding: "10px 12px", border: "1px solid #ddd",
    borderRadius: 4, fontSize: 14, outline: "none",
  },
  submit: {
    padding: "10px 0", background: "#18181b", color: "#fff",
    border: "none", borderRadius: 4, fontSize: 14, cursor: "pointer",
  },
  error: { color: "#dc2626", fontSize: 13, margin: 0 },
};
