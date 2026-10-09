import { invoke } from "@tauri-apps/api/core";
import type { Goal } from "@/types/Goal";
import type { GoalInput } from "@/types/GoalInput";
import type { GoalProgress } from "@/types/GoalProgress";
import type { Item } from "@/types/Item";
import type { Milestone } from "@/types/Milestone";
import type { Template } from "@/types/Template";

/** Typed wrappers for src-tauri/src/commands/goals_templates.rs. */
export const goalsApi = {
  list: () => invoke<GoalProgress[]>("list_goals"),
  create: (input: GoalInput) => invoke<Goal>("create_goal", { input }),
  update: (id: string, input: GoalInput) => invoke<Goal>("update_goal", { id, input }),
  achieve: (id: string, achieved: boolean) => invoke<Goal>("achieve_goal", { id, achieved }),
  setDeleted: (id: string, deleted: boolean) => invoke<null>("delete_goal", { id, deleted }),
  addMilestone: (goalId: string, title: string) =>
    invoke<Milestone>("add_milestone", { goalId, title }),
  renameMilestone: (id: string, title: string) => invoke<null>("rename_milestone", { id, title }),
  setMilestoneDeleted: (id: string, deleted: boolean) =>
    invoke<null>("delete_milestone", { id, deleted }),
};

export const templatesApi = {
  list: () => invoke<Template[]>("list_templates"),
  create: (name: string, itemIds: string[]) =>
    invoke<Template>("create_template", { name, itemIds }),
  setDeleted: (id: string, deleted: boolean) => invoke<null>("delete_template", { id, deleted }),
  apply: (id: string, startDate: string) => invoke<Item[]>("apply_template", { id, startDate }),
  deleteItems: (ids: string[]) => invoke<null>("delete_items", { ids }),
};
