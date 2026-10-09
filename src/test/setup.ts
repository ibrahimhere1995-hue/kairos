import "@testing-library/jest-dom/vitest";
import "@/i18n";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// Screens load several queries in turn; on a busy machine running the whole suite, the
// default 1 s wait for findBy*/waitFor is too short and tests fail at random.
configure({ asyncUtilTimeout: 3000 });

// jsdom has no matchMedia; default to "light, no reduced motion". Tests can override.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList,
});

// jsdom lacks pointer capture (used by Radix toast swipe) and scrollIntoView; real WebViews have both.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});
