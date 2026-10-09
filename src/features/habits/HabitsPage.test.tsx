import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { toLocalDateString } from "@/lib/dates/dayContext";
import { mockBackend } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";
import type { HabitStatus } from "@/types/HabitStatus";

const today = toLocalDateString(new Date());
const status = (fields: Partial<HabitStatus>): HabitStatus => ({
  habit: { id: "h1", title: "Read 10 pages", areaId: null, frequency: "daily", createdAt: "x" },
  doneToday: false,
  streak: 0,
  thisWeek: 0,
  perWeek: 7,
  recent: [],
  ...fields,
});

afterEach(() => clearMocks());

describe("Habits (P3-T02)", () => {
  it("adds a habit and ticks it for today", async () => {
    let habits: HabitStatus[] = [];
    const calls = mockBackend({
      list_habits: () => habits,
      create_habit: () => {
        habits = [status({})];
        return habits[0]?.habit;
      },
      set_habit_done: () => {
        habits = [status({ doneToday: true, streak: 1, thisWeek: 1, recent: [today] })];
        return null;
      },
    });
    const user = userEvent.setup();
    renderApp("/habits");
    expect(await screen.findByText(/No habits yet/)).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Habit" }), "Read 10 pages");
    await user.selectOptions(screen.getByRole("combobox", { name: "How often" }), "weekly:3");
    await user.click(screen.getByRole("button", { name: "Add habit" }));
    expect(calls.find((c) => c.cmd === "create_habit")?.args).toEqual({
      input: { title: "Read 10 pages", frequency: "weekly:3", areaId: null },
    });

    const list = await screen.findByRole("list", { name: "Habits" });
    expect(within(list).getByText(/Streak paused — start again today/)).toBeInTheDocument();
    await user.click(
      within(list).getByRole("checkbox", { name: "Mark “Read 10 pages” as done today" }),
    );
    await waitFor(() =>
      expect(calls.find((c) => c.cmd === "set_habit_done")?.args).toEqual({
        id: "h1",
        date: today,
        today,
        done: true,
      }),
    );
    expect(await within(list).findByText(/1 day in a row/)).toBeInTheDocument();
    expect(
      within(list).getByRole("img", { name: "Done on 1 day in the last 12 weeks" }),
    ).toBeInTheDocument();
  });
});
