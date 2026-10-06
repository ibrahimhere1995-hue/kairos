// Runs synchronously in <head>, before first paint, so the page never flashes the wrong theme.
// Keep THEME_STORAGE_KEY and the resolve logic in sync with src/app/theme/theme.ts.
(function () {
  var preference = "system";
  try {
    var stored = window.localStorage.getItem("kairos.theme");
    if (stored === "light" || stored === "dark" || stored === "system") preference = stored;
  } catch (e) {
    // Storage unavailable: fall back to the system theme.
  }
  var dark =
    preference === "dark" ||
    (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
})();
