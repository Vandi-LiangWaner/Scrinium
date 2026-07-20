import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname, "renderer"),
  base: "./",
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  plugins: [react()],
  build: { outDir: path.resolve(__dirname, "../desktop-dist"), emptyOutDir: true },
});
