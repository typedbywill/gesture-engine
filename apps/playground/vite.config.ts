import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "gesture-engine/core": path.resolve(__dirname, "../../packages/gesture-engine/src/core/index.ts"),
      "gesture-engine/browser": path.resolve(__dirname, "../../packages/gesture-engine/src/browser/index.ts"),
      "gesture-engine": path.resolve(__dirname, "../../packages/gesture-engine/src/index.ts")
    }
  },
  server: {
    port: 3000,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless"
    }
  }
});
