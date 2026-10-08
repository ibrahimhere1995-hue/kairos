import { format } from "date-fns";
import { clearMocks } from "@tauri-apps/api/mocks";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { friendlyDate } from "@/features/items/editor/friendlyDate";
import { useEditorStore } from "@/features/items/editorStore";
import i18n from "@/i18n";
import { toLocalDateString } from "@/lib/dates/dayContext";
import { mockBackend, type Call } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";
import type { Item } from "@/types/Item";

const originalTZ = process.env.TZ;

let n = 0;
function item(fields: Partial<Item>): Item {
  n += 1;
  return {
    id: `i${n}`,
    kind: "event",
    title: `Item ${n}`,
    notes: null,
    areaId: "a1",
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

const standup = item({
  title: "Standup",
  startAt: "2026-10-07T09:00:00.000Z",
  endAt: "2026-10-07T09:30:00.000Z",
});
const review = item({
  title: "Review",
  startAt: "2026-10-07T09:15:00.000Z",
  endAt: "2026-10-07T10:00:00.000Z",
});
const bills = item({ title: "Pay bills", kind: "task", dueDate: "2026-10-08", allDay: true });
const items = [standup, review, bills];

let calls: Call[] = [];
beforeEach(() => {
  process.env.TZ = "UTC";
  useEditorStore.setState({ open: false, itemId: null, prefill: null });
  calls = mockBackend({ list_items: () => items });
});
afterEach(() => {
  clearMocks();
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

const heading = () => screen.findByRole("heading", { level: 1 });

describe("Calendar", () => {
  it("shows the week with timed items side by side and the all-day row", async () => {
    renderApp("/calendar?view=week&date=2026-10-07");
    expect(await heading()).toHaveTextContent("5 – 11 Oct 2026");
    expect(
      await screen.findByRole("button", { name: /^Standup, 9:00 AM – 9:30 AM, Work/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Review,/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay bills" })).toBeInTheDocument();

    // Only the visible week is fetched (range-bounded).
    const range = calls.find((c) => c.cmd === "list_items")?.args.range;
    expect(range).toMatchObject({ startDate: "2026-10-05", endDate: "2026-10-12" });
  });

  it("switches views and steps through time", async () => {
    const user = userEvent.setup();
    renderApp("/calendar?view=week&date=2026-10-07");
    await heading();

    await user.click(screen.getByRole("radio", { name: "Month" }));
    expect(await heading()).toHaveTextContent("October 2026");
    expect(screen.getByRole("button", { name: "Open Wednesday 7 October" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(await heading()).toHaveTextContent("November 2026");

    await user.click(screen.getByRole("radio", { name: "Day" }));
    expect(await heading()).toHaveTextContent("Saturday 7 November 2026");
  });

  it("Today button and the T key jump back to today", async () => {
    const user = userEvent.setup();
    const todayTitle = format(new Date(), "EEEE d MMMM yyyy");
    renderApp("/calendar?view=day&date=2020-01-01");
    expect(await heading()).toHaveTextContent("Wednesday 1 January 2020");

    await user.click(screen.getByRole("button", { name: /^Today/ }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(todayTitle),
    );

    await user.click(screen.getByRole("button", { name: "Previous day" }));
    await user.click(screen.getByRole("button", { name: "Previous day" }));
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveTextContent(todayTitle);
    await user.keyboard("t");
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(todayTitle),
    );
  });

  it("opens a month day in the Day view", async () => {
    const user = userEvent.setup();
    renderApp("/calendar?view=month&date=2026-10-07");
    await user.click(await screen.findByRole("button", { name: "Open Thursday 8 October" }));
    expect(await heading()).toHaveTextContent("Thursday 8 October 2026");
    expect(await screen.findByRole("button", { name: "Pay bills" })).toBeInTheDocument();
  });

  it("lists the coming days in the Agenda", async () => {
    renderApp("/calendar?view=agenda&date=2026-10-07");
    // Day headings are relative to the real date ("Today", "Tomorrow", or "Wed 7 Oct").
    const heading = (date: string) => friendlyDate(date, toLocalDateString(new Date()), i18n.t);
    const wednesday = await screen.findByRole("region", { name: heading("2026-10-07") });
    expect(within(wednesday).getByText("Standup")).toBeInTheDocument();
    expect(within(wednesday).getByText("Review")).toBeInTheDocument();
    const thursday = screen.getByRole("region", { name: heading("2026-10-08") });
    expect(within(thursday).getByText("Pay bills")).toBeInTheDocument();
  });

  it("a click on an empty slot opens the editor pre-filled with that time", async () => {
    const { container } = renderApp("/calendar?view=day&date=2026-10-07");
    await screen.findByRole("button", { name: /^Standup/ });
    const column = container.querySelector<HTMLElement>("[data-day-column] > div");
    if (!column) throw new Error("day column not found");

    // jsdom: rect top is 0 and 1rem = 16px, so 14:00 is 14 h × 56 px.
    fireEvent.pointerDown(column, { button: 0, pointerId: 1, clientY: 14 * 56 });
    fireEvent.pointerUp(column, { pointerId: 1, clientY: 14 * 56 });

    const dialog = await screen.findByRole("dialog", { name: "New item" });
    expect(within(dialog).getByRole("radio", { name: "Event" })).toBeChecked();
    expect(within(dialog).getByText("2:00 PM · 1 h")).toBeInTheDocument();
  });
});
