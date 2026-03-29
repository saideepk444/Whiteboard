import { useState } from "react";
import { getAuth, clearAuth } from "./api";
import AuthPage from "./components/AuthPage";
import Dashboard from "./components/Dashboard";
import CanvasPage from "./components/CanvasPage";

type View =
  | { page: "auth" }
  | { page: "dashboard" }
  | { page: "canvas"; canvasId: string };

export default function App() {
  const [view, setView] = useState<View>(() =>
    getAuth() ? { page: "dashboard" } : { page: "auth" }
  );

  function handleAuth() {
    setView({ page: "dashboard" });
  }

  function handleLogout() {
    clearAuth();
    setView({ page: "auth" });
  }

  function handleOpenCanvas(canvasId: string) {
    setView({ page: "canvas", canvasId });
  }

  if (view.page === "auth") {
    return <AuthPage onAuth={handleAuth} />;
  }

  const auth = getAuth()!;

  if (view.page === "dashboard") {
    return (
      <Dashboard
        username={auth.username}
        onOpenCanvas={handleOpenCanvas}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <CanvasPage
      canvasId={view.canvasId}
      onBack={() => setView({ page: "dashboard" })}
    />
  );
}
