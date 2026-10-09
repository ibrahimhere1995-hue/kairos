import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/items/editorStore";
import { mockBackend } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";
import type { GoalProgress } from "@/types/GoalProgress";

const goal: GoalProgress = {
  goal: {
    id: "g1",
    title: "Run a 10k",
    description: null,
    areaId: null,
    targetDate: "2030-06-01",
    achievedAt: null,
  },
  milestones: [
    {
      milestone: { id: "m1", goalId: "g1", title: "Run 5k", targetDate: null, sortOrder: 0 },
      done: 1,
      total: 4,
    },
  ],
  done: 1,
  total: 4,
};

afterEach(() => {
  clearMocks();
  useEditorStore.setState({ open: false, itemId: null, prefill: null });
});

describe("Goals (P3-T03)", () => {
  it("adds a goal and a step", async () => {
    const calls = mockBackend({
      create_goal: () => goal.goal,
      add_milestone: () => goal.milestones[0]?.milestone,
    });
    const user = userEvent.setup();
    renderApp("/goals");
    await user.type(await screen.findByRole("textbox", { name: "Goal" }), "Run a 10k");
    await user.click(screen.getByRole("button", { name: "Add goal" }));
    await waitFor(() =>
      expect(calls.find((c) => c.cmd === "create_goal")?.args).toEqual({
        input: { title: "Run a 10k", description: null, areaId: null, targetDate: null },
      }),
    );
  });

  it("shows progress from linked tasks and adds a task to a step", async () => {
    mockBackend({ list_goals: () => [goal] });
    const user = userEvent.setup();
    renderApp("/goals");
    const bar = await screen.findByRole("progressbar", { name: "Progress of Run a 10k" });
    expect(bar).toHaveAttribute("aria-valuenow", "25");
    const steps = screen.getByRole("list", { name: "Steps of Run a 10k" });
    expect(within(steps).getByText("1 of 4 tasks done")).toBeInTheDocument();
    await user.click(within(steps).getByRole("button", { name: "Add task" }));
    expect(useEditorStore.getState().prefill).toMatchObject({
      milestoneId: "m1",
      schedule: "none",
    });
  });
});
