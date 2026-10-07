import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { clearMocks } from "@tauri-apps/api/mocks";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useThemeStore } from "@/app/theme/themeStore";
import { useUiStore } from "@/app/uiStore";
import { mockBackend } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";

const renderAt = (path = "/") => renderApp(path).router;

// My Day's heading is the greeting, the Calendar's is the visible dates; others use their name.
const HEADINGS: Record<string, RegExp> = {
  "My Day": /^Good (morning|afternoon|evening)\.$/,
  Calendar: /\d{4}$/,
};
const pageHeading = (name: string) =>
  screen.findByRole("heading", { level: 1, name: HEADINGS[name] ?? name });

describe("App shell", () => {
  beforeEach(() => {
    useUiStore.setState({ sidebarCollapsed: false });
    useThemeStore.setState({ preference: "light" });
    mockBackend();
  });
  afterEach(() => clearMocks());

  it("opens on My Day with the main landmarks", async () => {
    renderAt();
    expect(await pageHeading("My Day")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Day" })).toHaveAttribute("aria-current", "page");
  });

  it("navigates between every screen with the mouse", async () => {
    const user = userEvent.setup();
    renderAt();
    await pageHeading("My Day");

    for (const name of ["Calendar", "Inbox", "Settings", "My Day"]) {
      await user.click(screen.getByRole("link", { name }));
      expect(await pageHeading(name)).toBeInTheDocument();
      expect(screen.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
    }
  });

  it("navigates with the keyboard alone", async () => {
    const user = userEvent.setup();
    renderAt();
    await pageHeading("My Day");

    // Tab order follows the layout: skip link, top bar (disabled search is skipped), sidebar.
    await user.tab();
    expect(screen.getByRole("button", { name: "Skip to main content" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Add task" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toHaveFocus();
    await user.tab(); // My Day
    await user.tab(); // Calendar
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await pageHeading("Calendar")).toBeInTheDocument();
  });

  it("skip link moves focus to the main content", async () => {
    const user = userEvent.setup();
    renderAt();
    await pageHeading("My Day");
    await user.tab();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("collapses the sidebar but keeps every link's name", async () => {
    const user = userEvent.setup();
    renderAt();
    await pageHeading("My Day");

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    const expand = screen.getByRole("button", { name: "Expand sidebar" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: "Inbox" })).toBeInTheDocument();

    await user.click(expand);
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });

  it("toggles the theme from the top bar", async () => {
    const user = userEvent.setup();
    renderAt();
    await pageHeading("My Day");

    await user.click(screen.getByRole("button", { name: "Switch to dark theme" }));
    expect(useThemeStore.getState().preference).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
  });

  it("shows a friendly page for unknown addresses", async () => {
    renderAt("/does-not-exist");
    expect(await pageHeading("Nothing here")).toBeInTheDocument();
  });
});
