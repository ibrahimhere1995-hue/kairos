import { clearMocks } from "@tauri-apps/api/mocks";
import { screen } from "@testing-library/react";
import { addDays, format, startOfWeek } from "date-fns";
import { afterEach, describe, expect, it } from "vitest";
import { mockBackend } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";
import type { Item } from "@/types/Item";

afterEach(() => clearMocks());

const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
const item = (fields: Partial<Item>): Item => ({
  id: "i1",
  kind: "task",
  title: "Task",
  notes: null,
  areaId: null,
  priority: 0,
  allDay: true,
  startAt: null,
  endAt: null,
  dueDate: format(addDays(weekStart, -7), "yyyy-MM-dd"),
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
});

describe("Weekly review (P3-T06)", () => {
  it("shows what got done, what slipped and the balance of last week", async () => {
    const start = addDays(weekStart, -7);
    start.setHours(9);
    mockBackend({
      list_items: () => [
        item({ id: "d", title: "Send invoices", completedAt: start.toISOString() }),
        item({ id: "s", title: "Call the bank" }),
        item({
          id: "w",
          title: "Deep work",
          kind: "event",
          areaId: "a1",
          allDay: false,
          dueDate: null,
          startAt: start.toISOString(),
          endAt: new Date(start.getTime() + 2 * 3_600_000).toISOString(),
        }),
      ],
      focus_totals: () => [{ areaId: "a1", seconds: 1500 }],
    });
    renderApp("/review");
    expect(await screen.findByRole("heading", { name: "Weekly review" })).toBeInTheDocument();

    expect(await screen.findByText("Send invoices")).toBeInTheDocument();
    expect(screen.getByText("Call the bank")).toBeInTheDocument();
    expect(screen.getByText("2 h planned · 25 min focused")).toBeInTheDocument();
    expect(screen.getByText("Health got 0 hours this week.")).toBeInTheDocument();
  });
});
