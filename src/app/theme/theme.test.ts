import { describe, expect, it, vi } from "vitest";
import {
  applyTheme,
  readStoredPreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  writeStoredPreference,
} from "@/app/theme/theme";

describe("resolveTheme", () => {
  it("returns an explicit choice regardless of the OS setting", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the OS setting for Match system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("readStoredPreference", () => {
  const storageWith = (value: string | null) => ({ getItem: () => value });

  it("reads a valid stored preference", () => {
    expect(readStoredPreference(storageWith("dark"))).toBe("dark");
  });

  it("falls back to system for missing, invalid, or unavailable storage", () => {
    expect(readStoredPreference(storageWith(null))).toBe("system");
    expect(readStoredPreference(storageWith("purple"))).toBe("system");
    expect(readStoredPreference(undefined)).toBe("system");
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readStoredPreference(throwing)).toBe("system");
  });
});

describe("writeStoredPreference", () => {
  it("writes under the shared key and survives a throwing storage", () => {
    const setItem = vi.fn();
    writeStoredPreference({ setItem }, "light");
    expect(setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, "light");

    const throwing = {
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(() => writeStoredPreference(throwing, "dark")).not.toThrow();
  });
});

describe("applyTheme", () => {
  it("sets data-theme on the root", () => {
    const root = document.createElement("html");
    applyTheme("dark", root);
    expect(root.dataset.theme).toBe("dark");
  });

  it("adds the cross-fade class only when animating, then removes it", () => {
    vi.useFakeTimers();
    const root = document.createElement("html");
    applyTheme("light", root);
    expect(root.classList.contains("theme-transition")).toBe(false);

    applyTheme("dark", root, true);
    expect(root.classList.contains("theme-transition")).toBe(true);
    vi.runAllTimers();
    expect(root.classList.contains("theme-transition")).toBe(false);
    vi.useRealTimers();
  });
});
