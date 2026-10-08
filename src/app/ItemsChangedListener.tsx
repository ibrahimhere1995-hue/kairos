import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { itemKeys } from "@/features/items/queryKeys";
import { onDataReloaded, onItemsChanged } from "@/lib/api/events";

/**
 * Keeps this window's data fresh: refreshes item views when another window changes items,
 * and everything after a backup is restored.
 */
export function ItemsChangedListener() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const stops = [
      onItemsChanged(() => void queryClient.invalidateQueries({ queryKey: itemKeys.all })),
      onDataReloaded(() => void queryClient.invalidateQueries()),
    ];
    return () => {
      for (const stop of stops) void stop.then((unlisten) => unlisten());
    };
  }, [queryClient]);
  return null;
}
