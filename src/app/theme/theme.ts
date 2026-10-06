export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/**
 * Where the preference is cached for the pre-paint script (public/theme-init.js).
 * Keep the key and the resolve logic in sync with that file.
 */
export const THEME_STORAGE_KEY = "kairos.theme";
export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

const THEME_TRANSITION_CLASS = "theme-transition";
const THEME_TRANSITION_MS = 250;

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

/** Reads the cached preference; storage may be missing or throw (private mode), so fall back. */
export function readStoredPreference(
  storage: Pick<Storage, "getItem"> | undefined,
): ThemePreference {
  try {
    const stored = storage?.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

export function writeStoredPreference(
  storage: Pick<Storage, "setItem"> | undefined,
  preference: ThemePreference,
): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage unavailable: the theme still applies for this session.
  }
}

let transitionTimer: ReturnType<typeof setTimeout> | undefined;

/** Applies the theme to the root element; `animate` cross-fades colours (DESIGN_SYSTEM §6.2). */
export function applyTheme(
  theme: ResolvedTheme,
  root: HTMLElement = document.documentElement,
  animate = false,
): void {
  if (root.dataset.theme === theme) return;
  if (animate) {
    root.classList.add(THEME_TRANSITION_CLASS);
    clearTimeout(transitionTimer);
    transitionTimer = setTimeout(
      () => root.classList.remove(THEME_TRANSITION_CLASS),
      THEME_TRANSITION_MS,
    );
  }
  root.dataset.theme = theme;
}
