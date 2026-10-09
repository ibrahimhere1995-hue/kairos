/** True on macOS, used only to show ⌘ vs Ctrl in shortcut hints. */
export function isMac(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.userAgent);
}

/** True on Windows, where voice capture uses the OS speech service (P3-T14). */
export function isWindows(): boolean {
  return /Windows/i.test(navigator.userAgent);
}
