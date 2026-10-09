import { useQuery } from "@tanstack/react-query";
import { focusApi } from "@/lib/api/focus";

export const focusKey = ["focus"] as const;

/** Focused seconds per life area for sessions started in `[start, end)`. */
export function useFocusTotals(start: string, end: string, enabled = true) {
  return useQuery({
    enabled,
    queryKey: [...focusKey, start, end],
    queryFn: () => focusApi.totals(start, end),
  });
}
