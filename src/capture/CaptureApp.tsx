import { useEffect } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { QuickCapture } from "@/features/capture/QuickCapture";
import { hideCurrentWindow } from "@/lib/api/window";

const captureInput = () => document.querySelector<HTMLInputElement>("[data-autofocus]");

/**
 * The global Quick Capture window (Ctrl/⌘+Shift+Space). Focuses the input whenever it is
 * shown, and hides itself after saving, on Esc, or when the user clicks elsewhere.
 */
export function CaptureApp() {
  useEffect(() => {
    captureInput()?.focus();
    if (!isTauri()) return;
    const unlisten = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) {
        captureInput()?.focus();
        captureInput()?.select();
      } else {
        void hideCurrentWindow();
      }
    });
    return () => {
      void unlisten.then((stop) => stop());
    };
  }, []);

  const hide = () => void hideCurrentWindow();

  return (
    <main className="flex h-screen flex-col justify-center border border-border-strong bg-surface p-4 text-text">
      <QuickCapture onSaved={hide} onCancel={hide} />
    </main>
  );
}
