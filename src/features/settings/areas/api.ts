import { useMutation, useQueryClient } from "@tanstack/react-query";
import { areaKeys } from "@/features/items/queryKeys";
import { areasApi } from "@/lib/api/areas";
import type { Area } from "@/types/Area";
import type { AreaInput } from "@/types/AreaInput";

/** Every area change refreshes the area list everywhere (names and colours show on items). */
function useAreaMutation<V>(run: (vars: V) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSettled: () => queryClient.invalidateQueries({ queryKey: areaKeys.all }),
  });
}

export const useCreateArea = () => useAreaMutation((input: AreaInput) => areasApi.create(input));

export const useUpdateArea = () =>
  useAreaMutation(({ id, input }: { id: string; input: AreaInput }) => areasApi.update(id, input));

export const useArchiveArea = () =>
  useAreaMutation(({ id, archived }: { id: string; archived: boolean }) =>
    areasApi.archive(id, archived),
  );

/** Moves an area one place up or down; the list reorders at once and rolls back on failure. */
export function useMoveArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => areasApi.reorder(ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: areaKeys.all });
      const previous = queryClient.getQueryData<Area[]>(areaKeys.all);
      if (previous) {
        const byId = new Map(previous.map((a) => [a.id, a]));
        queryClient.setQueryData<Area[]>(
          areaKeys.all,
          ids.flatMap((id) => byId.get(id) ?? []),
        );
      }
      return { previous };
    },
    onError: (_e, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(areaKeys.all, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: areaKeys.all }),
  });
}

/** The ids with the one at `index` swapped with its neighbour (`direction` -1 = up). */
export function moved(ids: string[], index: number, direction: -1 | 1): string[] {
  const target = index + direction;
  if (target < 0 || target >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[target]] = [next[target] ?? "", next[index] ?? ""];
  return next;
}
