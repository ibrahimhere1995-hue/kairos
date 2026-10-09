import { addDays, addMinutes } from "date-fns";
import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/items/editorStore";
import { toLocalDateString } from "@/lib/dates/dayContext";
import { mockBackend, type Call } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";
import type { Dashboard } from "@/types/Dashboard";
import type { Item } from "@/types/Item";

// Items are built relative to the real clock, because My Day computes status from "now".
const now = new Date();
const today = toLocalDateString(now);
const yesterday = toLocalDateString(addDays(now, -1));

let n = 0;
function item(fields: Partial<Item>): Item {
  n += 1;
  return {
    id: `i${n}`,
    kind: "task",
    title: `Item ${n}`,
    notes: null,
    areaId: null,
    priority: 0,
    allDay: false,
    startAt: null,
    endAt: null,
    dueDate: null,
    completedAt: null,
    skippedAt: null,
    location: null,
    rrule: null,
    recurrenceParentId: null,
    originalStartAt: null,
    milestoneId: null,
    rescheduleCount: 0,
    source: "manual",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    deletedAt: null,
    ...fields,
  };
}

const callBank = item({ title: "Call bank", dueDate: today, allDay: true, areaId: "a1" });
const meeting = item({
  title: "Team sync",
  kind: "event",
  startAt: addMinutes(now, -10).toISOString(),
  endAt: addMinutes(now, 50).toISOString(),
  areaId: "a1",
});
const gym = item({ title: "Gym", dueDate: yesterday, allDay: true, areaId: "a2" });

const fullDay: Dashboard = {
  today: [meeting, callBank],
  overdue: [gym],
  thisWeek: [],
  doneToday: [],
};

let calls: Call[] = [];
const callsTo = (cmd: string) => calls.filter((c) => c.cmd === cmd);

beforeEach(() => useEditorStore.setState({ open: false, itemId: null }));
afterEach(() => clearMocks());

function section(name: string) {
  return screen.getByRole("region", { name: new RegExp(`^${name}`) });
}

describe("My Day", () => {
  it("shows an encouraging empty state with one clear action", async () => {
    calls = mockBackend();
    const user = userEvent.setup();
    renderApp();

    expect(
      await screen.findByText("A clear day. Perfect moment to plan something that matters."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add your first task" }));
    expect(await screen.findByRole("dialog", { name: "New item" })).toBeInTheDocument();
  });

  it("groups the day into Now, Today and Slipped with a summary line", async () => {
    calls = mockBackend({ get_dashboard: () => fullDay });
    renderApp();

    expect(await screen.findByText("1 task today, 1 meeting, 1 slipped by.")).toBeInTheDocument();
    expect(within(section("Now")).getByText("Team sync")).toBeInTheDocument();
    expect(within(section("Today")).getByText("Call bank")).toBeInTheDocument();
    // Slipped tasks get the caring card (PRD R6), worded, never just a colour.
    expect(within(section("1 thing slipped by")).getByText("Gym")).toBeInTheDocument();
  });

  it("completes a task with one click and offers Undo", async () => {
    calls = mockBackend({
      get_dashboard: () => fullDay,
      complete_item: () => ({ ...callBank, completedAt: new Date().toISOString() }),
      uncomplete_item: () => callBank,
    });
    const user = userEvent.setup();
    renderApp();

    const checkbox = await screen.findByRole("checkbox", { name: "Mark “Call bank” as done" });
    await user.click(checkbox);
    expect(checkbox).toHaveAttribute("aria-checked", "true");
    await waitFor(() => expect(callsTo("complete_item")[0]?.args).toEqual({ id: callBank.id }));

    await user.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(callsTo("uncomplete_item")[0]?.args).toEqual({ id: callBank.id }));
  });

  it("filters by life area with one click", async () => {
    calls = mockBackend({ get_dashboard: () => fullDay });
    const user = userEvent.setup();
    renderApp();
    await screen.findByText("Gym");

    await user.click(screen.getByRole("button", { name: "Health" }));
    expect(screen.getByRole("button", { name: "Health" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Gym")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Call bank")).not.toBeInTheDocument());
    expect(screen.queryByText("Team sync")).not.toBeInTheDocument();
  });

  it("opens the editor when an item's title is clicked", async () => {
    calls = mockBackend({
      get_dashboard: () => fullDay,
      get_item_detail: () => ({ item: callBank, checklist: [], reminders: [0] }),
    });
    const user = userEvent.setup();
    renderApp();
    await user.click(await screen.findByRole("button", { name: /^Call bank/ }));
    expect(await screen.findByRole("dialog", { name: "Edit item" })).toBeInTheDocument();
  });
});
