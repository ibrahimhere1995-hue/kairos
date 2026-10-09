import { invoke } from "@tauri-apps/api/core";
import type { Habit } from "@/types/Habit";
import type { HabitInput } from "@/types/HabitInput";
import type { HabitStatus } from "@/types/HabitStatus";

/** Typed wrappers for the habit commands (src-tauri/src/commands/inbox_habits.rs). */
export const habitsApi = {
  list: (today: string) => invoke<HabitStatus[]>("list_habits", { today }),
  create: (input: HabitInput) => invoke<Habit>("create_habit", { input }),
  update: (id: string, input: HabitInput) => invoke<Habit>("update_habit", { id, input }),
  setDeleted: (id: string, deleted: boolean) => invoke<null>("delete_habit", { id, deleted }),
  setDone: (id: string, date: string, today: string, done: boolean) =>
    invoke<null>("set_habit_done", { id, date, today, done }),
};
