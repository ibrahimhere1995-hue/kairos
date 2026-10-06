/** True on macOS, used only to show ⌘ vs Ctrl in shortcut hints. */
export function isMac(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.userAgent);
}
