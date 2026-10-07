import { useEffect } from "react";

/** True when a keypress belongs to a text field or an open dialog, not the page. */
function isTypingOrInDialog(target: EventTarget | null): boolean {
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return true;
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** PRD R1: "Today is always one click away (Today button + keyboard T)". */
export function useTodayShortcut(goToToday: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "t" || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingOrInDialog(event.target)) return;
      event.preventDefault();
      goToToday();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goToToday]);
}
