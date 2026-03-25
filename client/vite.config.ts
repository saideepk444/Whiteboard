import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      "/api": "http://server:3001",
      "/ws": {
        target: "ws://server:3001",
        ws: true,
      },
    },
  },
});
