/**
 * Base HTTP client.
 *
 * Every request automatically attaches the JWT from localStorage as a header:
 *   Authorization: Bearer <token>
 *
 * Think of this like a syscall wrapper: callers don't deal with raw fetch(),
 * they call api.post("/api/auth/login", body) and get back typed data or an error.
 */

const BASE = "";  // Vite proxies /api and /ws to the backend, so no hostname needed.

function getToken(): string | null {
  return localStorage.getItem("token");
}

export function saveAuth(token: string, userId: string, username: string) {
  localStorage.setItem("token", token);
  localStorage.setItem("userId", userId);
  localStorage.setItem("username", username);
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("userId");
  localStorage.removeItem("username");
}

export function getAuth(): { token: string; userId: string; username: string } | null {
  const token = localStorage.getItem("token");
  const userId = localStorage.getItem("userId");
  const username = localStorage.getItem("username");
  if (!token || !userId || !username) return null;
  return { token, userId, username };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }

  // 204 No Content — no body to parse
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
