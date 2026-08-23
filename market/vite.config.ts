import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
