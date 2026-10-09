import { addDays } from "date-fns";
import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/items/editorStore";
import { toLocalDateString } from "@/lib/dates/dayContext";
import { mockBackend, type Call } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";
import type { Item } from "@/types/Item";

const now = new Date();
const today = toLocalDateString(now);
const yesterday = toLocalDateString(addDays(now, -1));
const lastWeek = toLocalDateString(addDays(now, -7));

function task(fields: Partial<Item>): Item {
  return {
    id: "x",
    kind: "task",
    title: "Task",
    notes: null,
    areaId: null,
    priority: 0,
    allDay: true,
    startAt: null,
    endAt: null,
    dueDate: yesterday,
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

const vitamins = task({
  id: `s1@${yesterday}`,
  title: "Vitamins",
  rrule: "FREQ=DAILY",
  recurrenceParentId: "s1",
  originalStartAt: yesterday,
});
const review = task({
  id: `s2@${lastWeek}`,
  title: "Weekly review",
  dueDate: lastWeek,
  rrule: "FREQ=WEEKLY",
  recurrenceParentId: "s2",
  originalStartAt: lastWeek,
});
const bill = task({ id: "b1", title: "Pay the bill" });

let calls: Call[] = [];
const callsTo = (cmd: string) => calls.filter((c) => c.cmd === cmd);

beforeEach(() => {
  useEditorStore.setState({ open: false, itemId: null });
  calls = mockBackend({
    get_dashboard: () => ({
      today: [],
      overdue: [bill, vitamins, review],
      thisWeek: [],
      doneToday: [],
    }),
    complete_item: () => vitamins,
    skip_item: () => vitamins,
    unskip_item: () => vitamins,
    reschedule_item: () => review,
  });
});
afterEach(() => clearMocks());

const routinesCard = () => screen.findByRole("region", { name: "Routines you missed" });

describe("Routines you missed", () => {
  it("keeps missed routines out of the Slipped card", async () => {
    renderApp();
    const card = await routinesCard();
    expect(within(card).getByText("Vitamins")).toBeInTheDocument();
    expect(within(card).getByText("Weekly review")).toBeInTheDocument();
    const slipped = screen.getByRole("region", { name: /slipped by/ });
    expect(within(slipped).getByText("1 thing slipped by.")).toBeInTheDocument();
    expect(within(slipped).queryByText("Vitamins")).not.toBeInTheDocument();
  });

  it("closes a missed routine: done already, or skipped with Undo", async () => {
    const user = userEvent.setup();
    renderApp();
    await routinesCard();
    const choices = screen.getByRole("group", { name: "Choices for “Vitamins”" });
    expect(within(choices).queryByRole("button", { name: "Do it today" })).not.toBeInTheDocument();

    await user.click(within(choices).getByRole("button", { name: "Done already" }));
    await waitFor(() => expect(callsTo("complete_item")[0]?.args).toEqual({ id: vitamins.id }));

    await user.click(within(choices).getByRole("button", { name: "Skip this time" }));
    expect(await screen.findByText("Skipped “Vitamins” this time.")).toBeInTheDocument();
    // Two toasts are up (done, then skipped): Undo on the newest one.
    const undo = screen.getAllByRole("button", { name: "Undo" }).at(-1);
    if (undo) await user.click(undo);
    await waitFor(() => expect(callsTo("unskip_item")[0]?.args).toEqual({ id: vitamins.id }));
  });

  it("offers “Do it today” for weekly routines", async () => {
    const user = userEvent.setup();
    renderApp();
    await routinesCard();
    const choices = screen.getByRole("group", { name: "Choices for “Weekly review”" });
    await user.click(within(choices).getByRole("button", { name: "Do it today" }));
    await waitFor(() =>
      expect(callsTo("reschedule_item")[0]?.args).toEqual({
        id: review.id,
        schedule: { dueDate: today, startAt: null, endAt: null },
      }),
    );
  });
});
