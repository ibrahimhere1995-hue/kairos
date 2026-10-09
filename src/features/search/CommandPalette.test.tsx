import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useThemeStore } from "@/app/theme/themeStore";
import { useEditorStore } from "@/features/items/editorStore";
import { usePaletteStore } from "@/features/search/paletteStore";
import { toLocalDateString } from "@/lib/dates/dayContext";
import { mockBackend, type Call } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";
import type { Item } from "@/types/Item";

const today = toLocalDateString(new Date());

function item(id: string, title: string, fields: Partial<Item> = {}): Item {
  return {
    id,
    kind: "task",
    title,
    notes: null,
    areaId: null,
    priority: 0,
    allDay: true,
    startAt: null,
    endAt: null,
    dueDate: today,
    completedAt: null,
    skippedAt: null,
    location: null,
    rrule: null,
    recurrenceParentId: null,
    originalStartAt: null,
    milestoneId: null,
    rescheduleCount: 0,
    source: "manual",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...fields,
  };
}

const dentist = item("d1", "Call the dentist");
const card = item("c1", "Bank visit", { dueDate: null, allDay: false, notes: "dental card" });

let calls: Call[] = [];
const callsTo = (cmd: string) => calls.filter((c) => c.cmd === cmd);

beforeEach(() => {
  usePaletteStore.setState({ open: false });
  useEditorStore.setState({ open: false, itemId: null });
  useThemeStore.setState({ preference: "light", textSize: "default" });
  calls = mockBackend({
    search: ({ query }) =>
      String(query).startsWith("dent")
        ? [
            { item: dentist, matchedIn: "title" },
            { item: card, matchedIn: "notes" },
          ]
        : [],
    create_item: () => dentist,
  });
});
afterEach(() => clearMocks());

async function openPalette() {
  const user = userEvent.setup();
  renderApp();
  await screen.findByRole("main");
  await user.keyboard("{Control>}k{/Control}");
  const dialog = await screen.findByRole("dialog", { name: "Search and commands" });
  const input = within(dialog).getByRole("combobox");
  return { user, dialog, input };
}

describe("Search and command palette (PRD R9)", () => {
  it("opens with Ctrl+K and from the top bar", async () => {
    const { user, input } = await openPalette();
    expect(input).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Search or type a command/ }));
    expect(await screen.findByRole("dialog", { name: "Search and commands" })).toBeInTheDocument();
  });

  it("finds items grouped by status and opens one with Enter", async () => {
    const { user, dialog, input } = await openPalette();
    await user.type(input, "dent");
    expect(await within(dialog).findByText("Call the dentist")).toBeInTheDocument();
    expect(within(dialog).getByText("Today")).toBeInTheDocument();
    expect(within(dialog).getByText("No date")).toBeInTheDocument();
    expect(within(dialog).getByText("Found in notes")).toBeInTheDocument();

    // The first option is selected; arrow down to the first result if a command came first.
    const options = within(dialog).getAllByRole("option");
    const target = options.findIndex((o) => o.textContent?.includes("Call the dentist"));
    for (let i = 0; i < target; i++) await user.keyboard("{ArrowDown}");
    expect(options[target]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(useEditorStore.getState()).toMatchObject({ open: true, itemId: "d1" }),
    );
  });

  it("runs commands, e.g. switching theme", async () => {
    const { user, input } = await openPalette();
    await user.type(input, "dark theme");
    expect(await screen.findByRole("option", { name: "Switch to dark theme" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.keyboard("{Enter}");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("offers to show a typed date in the calendar", async () => {
    const { input, user } = await openPalette();
    await user.type(input, "12 oct");
    expect(
      await screen.findByRole("option", { name: /^Show .* 12 Oct .* in the calendar/ }),
    ).toBeInTheDocument();
  });

  it("offers to create a task when nothing is found", async () => {
    const { user, dialog, input } = await openPalette();
    await user.type(input, "Water the garden");
    expect(
      await within(dialog).findByText(
        "Nothing found for “Water the garden”. Create it as a new task?",
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("option", { name: /Create: “Water the garden”/ }));
    await waitFor(() =>
      expect(callsTo("create_item")[0]?.args.input).toMatchObject({ title: "Water the garden" }),
    );
  });
});
