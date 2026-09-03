import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: { port: 5173 },
  build: {
    // Fast loading is an explicit MVP priority. Splitting the two big vendors
    // out of the app chunk lets the browser parse them in parallel and keeps
    // them cached across deploys of the game code itself.
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
          rapier: ["@react-three/rapier"],
          react: ["react", "react-dom"],
        },
      },
    },
    // Rapier ships its physics engine as inlined wasm; ~800kB gzipped is the
    // floor for that chunk, so the warning is noise rather than a signal here.
    chunkSizeWarningLimit: 2500,
  },
});
