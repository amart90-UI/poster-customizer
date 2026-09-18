import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// The site is deployed to GitHub Pages under /<repo>/.
// Set VITE_BASE at build time (the deploy workflow does this automatically).
// Locally it falls back to "/" so `npm run dev` works without config.
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
