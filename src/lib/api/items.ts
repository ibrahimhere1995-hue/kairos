import { invoke } from "@tauri-apps/api/core";
import type { ChecklistEntryInput } from "@/types/ChecklistEntryInput";
import type { ChecklistItem } from "@/types/ChecklistItem";
import type { Dashboard } from "@/types/Dashboard";
import type { DashboardQuery } from "@/types/DashboardQuery";
import type { DateRange } from "@/types/DateRange";
import type { EditScope } from "@/types/EditScope";
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
  /** `scope` matters for repeating items only: this occurrence (default) or this and following. */
  update: (id: string, input: ItemInput, scope?: EditScope) =>
    invoke<Item>("update_item", { id, input, scope: scope ?? null }),
  delete: (id: string, scope?: EditScope) =>
    invoke<null>("delete_item", { id, scope: scope ?? null }),
  restore: (id: string) => invoke<Item>("restore_item", { id }),
  complete: (id: string) => invoke<Item>("complete_item", { id }),
  uncomplete: (id: string) => invoke<Item>("uncomplete_item", { id }),
  reschedule: (id: string, schedule: ScheduleInput) =>
    invoke<Item>("reschedule_item", { id, schedule }),
  rescheduleMany: (ids: string[], schedule: ScheduleInput) =>
    invoke<Item[]>("reschedule_items", { ids, schedule }),
  skip: (id: string) => invoke<Item>("skip_item", { id }),
  unskip: (id: string) => invoke<Item>("unskip_item", { id }),
  /** Inbox tasks (no date), newest first, for time-blocking. */
  unscheduled: () => invoke<Item[]>("list_unscheduled"),
  list: (range: DateRange, filters?: ItemFilters) =>
    invoke<Item[]>("list_items", { range, filters: filters ?? null }),
  dashboard: (query: DashboardQuery) => invoke<Dashboard>("get_dashboard", { query }),
  detail: (id: string) => invoke<ItemDetail>("get_item_detail", { id }),
  setChecklist: (itemId: string, entries: ChecklistEntryInput[]) =>
    invoke<ChecklistItem[]>("set_checklist", { itemId, entries }),
};
