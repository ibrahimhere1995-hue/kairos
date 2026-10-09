import { addDays } from "date-fns";
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

const now = new Date();
const today = toLocalDateString(now);
const tomorrow = toLocalDateString(addDays(now, 1));
const twoDaysAgo = toLocalDateString(addDays(now, -2));

function task(id: string, title: string, fields: Partial<Item> = {}): Item {
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
    dueDate: twoDaysAgo,
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

const bill = task("b1", "Pay the bill");
const essay = task("e1", "Write essay", { rescheduleCount: 3 });

let overdue: Item[] = [];
let todayItems: Item[] = [];
let calls: Call[] = [];
const callsTo = (cmd: string) => calls.filter((c) => c.cmd === cmd);
const dashboard = (): Dashboard => ({ today: todayItems, overdue, thisWeek: [], doneToday: [] });

beforeEach(() => {
  overdue = [bill, essay];
  todayItems = [];
  useEditorStore.setState({ open: false, itemId: null });
  calls = mockBackend({
    get_dashboard: dashboard,
    reschedule_item: ({ id }) => {
      overdue = overdue.filter((i) => i.id !== id);
      return bill;
    },
    reschedule_items: ({ ids }) => {
      todayItems = overdue.map((i) => ({ ...i, dueDate: today }));
      overdue = overdue.filter((i) => !(ids as string[]).includes(i.id));
      return [bill, essay];
    },
    skip_item: ({ id }) => {
      overdue = overdue.filter((i) => i.id !== id);
      return bill;
    },
    unskip_item: () => bill,
    complete_item: () => bill,
    get_item_detail: () => ({ item: essay, checklist: [], reminders: [] }),
  });
});
afterEach(() => clearMocks());

async function card() {
  return screen.findByRole("region", { name: /things? slipped by/ });
}

function choices(title: string) {
  return screen.getByRole("group", { name: `Choices for “${title}”` });
}

describe("Slipped card (PRD R6)", () => {
  it("asks kindly and gives each task a new moment", async () => {
    const user = userEvent.setup();
    renderApp();
    expect(within(await card()).getByText("2 things slipped by.")).toBeInTheDocument();
    expect(screen.getByText("Want to give them a new moment?")).toBeInTheDocument();

    await user.click(within(choices("Pay the bill")).getByRole("button", { name: "Today" }));
    await waitFor(() =>
      expect(callsTo("reschedule_item")[0]?.args).toEqual({
        id: "b1",
        schedule: { dueDate: today, startAt: null, endAt: null },
      }),
    );
    expect(await screen.findByText("1 thing slipped by.")).toBeInTheDocument();
  });

  it("moves a task to tomorrow", async () => {
    const user = userEvent.setup();
    renderApp();
    await card();
    await user.click(within(choices("Pay the bill")).getByRole("button", { name: "Tomorrow" }));
    await waitFor(() =>
      expect(callsTo("reschedule_item")[0]?.args).toMatchObject({
        schedule: { dueDate: tomorrow },
      }),
    );
  });

  it("lets a task go, with Undo", async () => {
    const user = userEvent.setup();
    renderApp();
    await card();
    await user.click(within(choices("Pay the bill")).getByRole("button", { name: "Let it go" }));
    await waitFor(() => expect(callsTo("skip_item")[0]?.args).toEqual({ id: "b1" }));
    await user.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(callsTo("unskip_item")[0]?.args).toEqual({ id: "b1" }));
  });

  it("marks a task done already", async () => {
    const user = userEvent.setup();
    renderApp();
    await card();
    await user.click(within(choices("Pay the bill")).getByRole("button", { name: "Done already" }));
    await waitFor(() => expect(callsTo("complete_item")[0]?.args).toEqual({ id: "b1" }));
  });

  it("moves everything to today at once, then says all caught up", async () => {
    const user = userEvent.setup();
    renderApp();
    await card();
    await user.click(screen.getByRole("button", { name: "Move all to today" }));
    await waitFor(() =>
      expect(callsTo("reschedule_items")[0]?.args).toEqual({
        ids: ["b1", "e1"],
        schedule: { dueDate: today, startAt: null, endAt: null },
      }),
    );
    expect(await screen.findByText("All caught up. Nice work.")).toBeInTheDocument();
  });

  it("offers to break a task that keeps moving into steps", async () => {
    const user = userEvent.setup();
    renderApp();
    await card();
    expect(
      screen.getByText("This one keeps moving. Break it into smaller steps?"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Break it down" }));
    const editor = await screen.findByRole("dialog", { name: "Edit item" });
    await waitFor(() =>
      expect(within(editor).getByRole("button", { name: "Add a step" })).toHaveFocus(),
    );
  });
});

describe("A very long slipped list (P4-T01)", () => {
  it("shows 50 at a time, so My Day stays light", async () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      task(`s${i}`, `Old task ${i}`, { dueDate: twoDaysAgo }),
    );
    mockBackend({
      get_dashboard: (): Dashboard => ({ today: [], overdue: many, thisWeek: [], doneToday: [] }),
    });
    const user = userEvent.setup();
    renderApp("/");
    expect(await screen.findByText("Old task 0")).toBeInTheDocument();
    expect(screen.queryByText("Old task 50")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Show 50 more/ }));
    expect(screen.getByText("Old task 99")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /20 not shown/ })).toBeInTheDocument();
  });
});
