import type { TextSize } from "@/types/TextSize";

/**
 * Text-size setting (DESIGN_SYSTEM §4): scales the root font size, so every rem-based size
 * and space follows. Cached in localStorage for the pre-paint script (public/theme-init.js).
 */
export const TEXT_SIZE_STORAGE_KEY = "kairos.textSize";
export const TEXT_SIZES: TextSize[] = ["small", "default", "large", "xl"];

export function isTextSize(value: unknown): value is TextSize {
  return TEXT_SIZES.includes(value as TextSize);
}

export function readStoredTextSize(storage: Pick<Storage, "getItem"> | undefined): TextSize {
  try {
    const stored = storage?.getItem(TEXT_SIZE_STORAGE_KEY);
    return isTextSize(stored) ? stored : "default";
  } catch {
    return "default";
  }
}

/** "default" removes the attribute; the others match `:root[data-text-size=…]` in tokens.css. */
export function applyTextSize(size: TextSize, root: HTMLElement = document.documentElement): void {
  if (size === "default") delete root.dataset.textSize;
  else root.dataset.textSize = size;
}
