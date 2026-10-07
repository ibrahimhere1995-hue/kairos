import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { itemKeys } from "@/features/items/queryKeys";
import { onItemsChanged } from "@/lib/api/events";

/** Refreshes every item view when another window (e.g. Quick Capture) changes items. */
export function ItemsChangedListener() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const stop = onItemsChanged(
      () => void queryClient.invalidateQueries({ queryKey: itemKeys.all }),
    );
    return () => {
      void stop.then((unlisten) => unlisten());
    };
  }, [queryClient]);
  return null;
}
