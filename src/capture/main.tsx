import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import "@fontsource-variable/inter";
import "@/i18n";
import { createQueryClient } from "@/app/queryClient";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { CaptureApp } from "@/capture/CaptureApp";
import "@/styles/globals.css";

// Entry for the Quick Capture window (capture.html). Fraunces is not loaded: the bar is all Inter.
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found in capture.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={createQueryClient()}>
      <ThemeProvider>
        <MotionConfig reducedMotion="user">
          <CaptureApp />
        </MotionConfig>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
