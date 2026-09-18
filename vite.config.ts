import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Use a RELATIVE base ("./") by default so the built asset URLs work no matter
// what subpath the site is served from — GitHub Pages serves under
// /<repo-name>/, and a relative base resolves correctly there without needing
// to know the repo name at build time. `npm run dev` still works with "./".
// VITE_BASE can still override this if an absolute base is ever needed.
const base = process.env.VITE_BASE ?? "./";

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
