import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// The dashboard (:5173) and server (:8787) are different origins, so relative
// URLs are proxied to the backend in dev (README). Same-origin in prod behind a
// single reverse proxy needs no config.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@kibitzer/shared": fileURLToPath(
        new URL("../../packages/shared/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    proxy: {
      "/events": { target: "http://localhost:8787", changeOrigin: true },
      "/session": "http://localhost:8787",
      "/persona": "http://localhost:8787",
      "/api": "http://localhost:8787",
    },
  },
});
