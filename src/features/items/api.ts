import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { areasApi } from "@/lib/api/areas";
import { itemsApi } from "@/lib/api/items";
import { useToastStore } from "@/lib/toastStore";
import { areaKeys, itemKeys } from "@/features/items/queryKeys";
import type { ChecklistEntryInput } from "@/types/ChecklistEntryInput";
import type { DashboardQuery } from "@/types/DashboardQuery";
import type { DateRange } from "@/types/DateRange";
import type { Item } from "@/types/Item";
import type { ItemInput } from "@/types/ItemInput";

export function useAreas() {
  return useQuery({ queryKey: areaKeys.all, queryFn: areasApi.list, staleTime: Infinity });
}

export function useItemDetail(id: string | null) {
  return useQuery({
    queryKey: itemKeys.detail(id ?? ""),
    queryFn: () => itemsApi.detail(id ?? ""),
    enabled: id !== null,
  });
}

export interface SaveItemArgs {
  id: string | null;
  input: ItemInput;
  checklist: ChecklistEntryInput[];
  /** Skip the checklist call when nothing changed (and for new items with no steps). */
  checklistChanged: boolean;
}

/** Creates or updates an item, then its checklist; refreshes every item view afterwards. */
export function useSaveItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input, checklist, checklistChanged }: SaveItemArgs) => {
      const item = id === null ? await itemsApi.create(input) : await itemsApi.update(id, input);
      if (checklistChanged) await itemsApi.setChecklist(item.id, checklist);
      return item;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: itemKeys.all }),
  });
}

/** Moves an item to the Trash and offers Undo (DESIGN_SYSTEM §2.4: forgiving). */
export function useDeleteItem() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const showToast = useToastStore((state) => state.show);
  const refresh = () => queryClient.invalidateQueries({ queryKey: itemKeys.all });
  return useMutation({
    mutationFn: (item: Item) => itemsApi.delete(item.id),
    onSuccess: (_, item) => {
      showToast({
        message: t("toast.movedToTrash", { title: item.title }),
        actionLabel: t("toast.undo"),
        onAction: () => void itemsApi.restore(item.id).then(refresh),
      });
    },
    onSettled: refresh,
  });
}

/** Animation time for the completion tick before the item moves to "Done today". */
const COMPLETE_SETTLE_MS = 450;

export function useCompleteItem() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const showToast = useToastStore((state) => state.show);
  const refresh = () => queryClient.invalidateQueries({ queryKey: itemKeys.all });
  return useMutation({
    mutationFn: (item: Item) => itemsApi.complete(item.id),
    onSuccess: (_, item) => {
      showToast({
        message: t("toast.done", { title: item.title }),
        actionLabel: t("toast.undo"),
        onAction: () => void itemsApi.uncomplete(item.id).then(refresh),
      });
    },
    // Let the tick animation finish before the list re-sorts.
    onSettled: () => setTimeout(() => void refresh(), COMPLETE_SETTLE_MS),
  });
}

export function useUncompleteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (item: Item) => itemsApi.uncomplete(item.id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: itemKeys.all }),
  });
}

export function useDashboard(query: DashboardQuery) {
  return useQuery({
    queryKey: itemKeys.dashboard(query.today),
    queryFn: () => itemsApi.dashboard(query),
  });
}

export function useItemsInRange(range: DateRange) {
  return useQuery({
    queryKey: itemKeys.range(range.start, range.end),
    queryFn: () => itemsApi.list(range),
  });
}
