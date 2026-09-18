import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import { injectFontStylesheet } from "@/fonts/registry";
import "@/styles.css";

// Warm the default UI font so the interface renders in Inter immediately.
injectFontStylesheet("Inter");

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
