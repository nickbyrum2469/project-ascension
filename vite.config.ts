import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    sourcemap: false,
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 9000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/babylonjs")) return "babylon";
          return undefined;
        }
      }
    }
  },
  server: {
    port: 4173,
    strictPort: true
  }
});
