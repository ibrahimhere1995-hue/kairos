// Runs synchronously in <head>, before first paint, so the page never flashes the wrong theme
// or text size. Keep the keys and logic in sync with src/app/theme/theme.ts and textSize.ts.
(function () {
  var root = document.documentElement;
  var preference = "system";
  var textSize = "default";
  try {
    var stored = window.localStorage.getItem("kairos.theme");
    if (stored === "light" || stored === "dark" || stored === "system") preference = stored;
    var size = window.localStorage.getItem("kairos.textSize");
    if (size === "small" || size === "large" || size === "xl") textSize = size;
  } catch (e) {
    // Storage unavailable: fall back to the system theme and default text size.
  }
  var dark =
    preference === "dark" ||
    (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.setAttribute("data-theme", dark ? "dark" : "light");
  if (textSize !== "default") root.setAttribute("data-text-size", textSize);
})();
