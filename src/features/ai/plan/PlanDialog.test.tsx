import { addDays } from "date-fns";
import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { usePlanStore } from "@/features/ai/plan/planStore";
import { toLocalDateString } from "@/lib/dates/dayContext";
import { emptyDashboard, mockBackend } from "@/test/mockBackend";
import { makeItem } from "@/test/makeItem";
import { renderApp } from "@/test/renderWithProviders";

afterEach(() => {
  clearMocks();
  usePlanStore.getState().close();
});

const tomorrow = toLocalDateString(addDays(new Date(), 1));
const report = makeItem({ id: "r", title: "Write report", dueDate: toLocalDateString(new Date()) });

describe("Plan my day (P3-T11)", () => {
  it("proposes slots and adds only the accepted ones to the calendar", async () => {
    const calls = mockBackend({
      ai_status: () => ({ consented: true, hasKey: true }),
      get_dashboard: () => ({ ...emptyDashboard, today: [report] }),
      list_unscheduled: () => [makeItem({ id: "u", title: "Call bank" })],
      ai_plan: () => [
        { taskId: "r", date: tomorrow, start: "10:00", durationMinutes: 60 },
        { taskId: "u", date: tomorrow, start: "11:30", durationMinutes: 30 },
      ],
      reschedule_item: ({ id }) => makeItem({ id: id as string }),
    });
    const user = userEvent.setup();
    renderApp("/");
    await user.click(await screen.findByRole("button", { name: "Plan my day" }));
    const dialog = await screen.findByRole("dialog", { name: "Plan with AI" });
    await user.click(within(dialog).getByRole("button", { name: "Make a plan" }));

    const request = calls.find((c) => c.cmd === "ai_plan")?.args.request as {
      tasks: { id: string }[];
    };
    await waitFor(() => expect(within(dialog).getByText("Write report")).toBeInTheDocument());
    expect(request.tasks.map((t) => t.id)).toEqual(["r", "u"]);

    await user.click(within(dialog).getByRole("checkbox", { name: /Call bank/ }));
    await user.click(within(dialog).getByRole("button", { name: "Add 1 to my calendar" }));
    await waitFor(() =>
      expect(calls.filter((c) => c.cmd === "reschedule_item").map((c) => c.args.id)).toEqual(["r"]),
    );
    expect(await screen.findByText("1 task planned.")).toBeInTheDocument();
  });

  it("points to Settings while smart features are off", async () => {
    mockBackend();
    usePlanStore.getState().openPlan("week");
    renderApp("/");
    const dialog = await screen.findByRole("dialog", { name: "Plan with AI" });
    expect(within(dialog).getByRole("button", { name: "Go to Settings" })).toBeInTheDocument();
  });
});
