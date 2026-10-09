import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { usePlanStore } from "@/features/ai/plan/planStore";
import { DEFAULT_SETTINGS } from "@/lib/api/settings";
import { toLocalDateString } from "@/lib/dates/dayContext";
import { emptyDashboard, mockBackend } from "@/test/mockBackend";
import { makeItem } from "@/test/makeItem";
import { renderApp } from "@/test/renderWithProviders";

afterEach(() => {
  clearMocks();
  usePlanStore.getState().close();
});

const today = toLocalDateString(new Date());
// Working hours span the whole day, so the test never depends on the clock.
const allDay = { ...DEFAULT_SETTINGS, workDayStart: "00:00", workDayEnd: "23:59" };
const tasks = Array.from({ length: 60 }, (_, i) =>
  makeItem({ id: `t${i}`, title: `Task ${i}`, dueDate: today }),
);

describe("Today looks full (P3-T12)", () => {
  it("says so calmly and offers to lighten today with AI", async () => {
    const calls = mockBackend({
      get_settings: () => allDay,
      ai_status: () => ({ consented: true, hasKey: true }),
      get_dashboard: () => ({ ...emptyDashboard, today: tasks }),
      ai_plan: () => [],
    });
    const user = userEvent.setup();
    renderApp("/");
    expect(await screen.findByText(/Today looks full/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Suggest what to move" }));

    const dialog = await screen.findByRole("dialog", { name: "Plan with AI" });
    expect(within(dialog).queryByRole("radio", { name: "Today" })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Make a plan" }));
    await waitFor(() => expect(calls.some((c) => c.cmd === "ai_plan")).toBe(true));
    const request = calls.find((c) => c.cmd === "ai_plan")?.args.request as {
      instruction: string;
      days: { date: string }[];
      dayStart: string;
    };
    expect(request.instruction).toMatch(/^Today is overbooked/);
    expect(request.days.map((d) => d.date)).not.toContain(today);
    expect(request.dayStart).toBe("00:00");
  });

  it("only suggests moving some by hand while smart features are off", async () => {
    mockBackend({
      get_settings: () => allDay,
      get_dashboard: () => ({ ...emptyDashboard, today: tasks }),
    });
    renderApp("/");
    expect(await screen.findByText(/move a few to another day/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suggest what to move" })).not.toBeInTheDocument();
  });
});
