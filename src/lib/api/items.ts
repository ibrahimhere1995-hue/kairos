import { invoke } from "@tauri-apps/api/core";
import type { ChecklistEntryInput } from "@/types/ChecklistEntryInput";
import type { ChecklistItem } from "@/types/ChecklistItem";
import type { Dashboard } from "@/types/Dashboard";
import type { DashboardQuery } from "@/types/DashboardQuery";
import type { DateRange } from "@/types/DateRange";
import type { Item } from "@/types/Item";
import type { ItemDetail } from "@/types/ItemDetail";
import type { ItemFilters } from "@/types/ItemFilters";
import type { ItemInput } from "@/types/ItemInput";
import type { ScheduleInput } from "@/types/ScheduleInput";

/**
 * Typed wrappers for the Rust item commands (src-tauri/src/commands/items.rs).
 * Components never call `invoke` directly (PROJECT_RULES). On failure these reject with an
 * `ErrorPayload`; use `toErrorPayload` from `./errors`.
 */
export const itemsApi = {
  create: (input: ItemInput) => invoke<Item>("create_item", { input }),
  update: (id: string, input: ItemInput) => invoke<Item>("update_item", { id, input }),
  delete: (id: string) => invoke<null>("delete_item", { id }),
  restore: (id: string) => invoke<Item>("restore_item", { id }),
  complete: (id: string) => invoke<Item>("complete_item", { id }),
  uncomplete: (id: string) => invoke<Item>("uncomplete_item", { id }),
  reschedule: (id: string, schedule: ScheduleInput) =>
    invoke<Item>("reschedule_item", { id, schedule }),
  list: (range: DateRange, filters?: ItemFilters) =>
    invoke<Item[]>("list_items", { range, filters: filters ?? null }),
  dashboard: (query: DashboardQuery) => invoke<Dashboard>("get_dashboard", { query }),
  detail: (id: string) => invoke<ItemDetail>("get_item_detail", { id }),
  setChecklist: (itemId: string, entries: ChecklistEntryInput[]) =>
    invoke<ChecklistItem[]>("set_checklist", { itemId, entries }),
};
