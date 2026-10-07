import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { areasApi } from "@/lib/api/areas";
import { itemsApi } from "@/lib/api/items";
import { areaKeys, itemKeys } from "@/features/items/queryKeys";
import type { ChecklistEntryInput } from "@/types/ChecklistEntryInput";
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

export function useDeleteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => itemsApi.delete(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: itemKeys.all }),
  });
}
