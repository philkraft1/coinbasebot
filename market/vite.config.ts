import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { stripBaseAppIdHtml } from "./src/stripBaseAppIdHtml.ts";

/** Same SPA as index.html, without the homepage-only Base.dev ownership tag. */
function emitAppHtml() {
  return {
    name: "emit-app-html",
    closeBundle() {
      const indexPath = resolve(import.meta.dirname, "dist/index.html");
      const html = readFileSync(indexPath, "utf8");
      writeFileSync(resolve(import.meta.dirname, "dist/app.html"), stripBaseAppIdHtml(html));
    },
  };
}

export default defineConfig({
  plugins: [react(), emitAppHtml()],
  server: {
    host: "127.0.0.1",
    port: 43147,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:43148",
        changeOrigin: true,
      },
      "/coinbase-api": {
        target: "https://api.coinbase.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/coinbase-api/, ""),
      },
    },
  },
});
