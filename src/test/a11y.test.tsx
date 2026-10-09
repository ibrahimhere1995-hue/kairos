import axe from "axe-core";
import { clearMocks } from "@tauri-apps/api/mocks";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/items/editorStore";
import { usePaletteStore } from "@/features/search/paletteStore";
import { mockBackend } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";

// P2-T13: a quick axe-core check of every screen in unit tests (WCAG 2.2 A/AA).
// jsdom draws nothing, so colour contrast is left to the E2E scan and the token contrast test.
const OPTIONS: axe.RunOptions = {
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
  rules: { "color-contrast": { enabled: false }, "target-size": { enabled: false } },
};

async function violations(): Promise<string[]> {
  const result = await axe.run(document.body, OPTIONS);
  return result.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
}

afterEach(() => {
  clearMocks();
  useEditorStore.setState({ open: false, itemId: null });
  usePaletteStore.setState({ open: false });
});

describe("Accessibility of every screen (axe-core)", () => {
  for (const [name, path, heading] of [
    ["My Day", "/", "main"],
    ["Calendar", "/calendar?view=week&date=2026-10-07", "main"],
    ["Inbox", "/inbox", "main"],
    ["Trash", "/trash", "main"],
    ["Settings", "/settings", "main"],
  ] as const) {
    it(`${name} has no violations`, async () => {
      mockBackend();
      renderApp(path);
      await screen.findByRole(heading);
      await screen.findAllByRole("heading", { level: 1 });
      expect(await violations()).toEqual([]);
    });
  }

  it("the editor, Quick Capture and the search palette have no violations", async () => {
    mockBackend();
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("main");

    await user.click(screen.getByRole("button", { name: "Add task" }));
    await screen.findByRole("dialog", { name: "Quick capture" });
    expect(await violations()).toEqual([]);
    await user.keyboard("{Escape}");

    act(() => useEditorStore.getState().openNew());
    await screen.findByRole("dialog", { name: "New item" });
    expect(await violations()).toEqual([]);
    await user.keyboard("{Escape}");

    act(() => usePaletteStore.getState().openPalette());
    await screen.findByRole("dialog", { name: "Search and commands" });
    expect(await violations()).toEqual([]);
  });
});
