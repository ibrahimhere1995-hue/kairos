import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces/opsz.css";
import "@/i18n";
import App from "@/App";
import { showMainWindow } from "@/lib/api/window";
import "@/styles/globals.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Show the window only once the first frame (already themed) has painted.
requestAnimationFrame(() => {
  showMainWindow().catch(() => {
    // Ignored: Rust's startup fallback shows the window if this fails.
  });
});
