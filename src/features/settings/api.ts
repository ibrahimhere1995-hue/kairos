import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_SETTINGS, settingsApi } from "@/lib/api/settings";
import type { AppSettings } from "@/types/AppSettings";

export const settingsKey = ["settings"] as const;

export function useAppSettings() {
  return useQuery({ queryKey: settingsKey, queryFn: settingsApi.get, staleTime: Infinity });
}

/** Saves a change to one or more settings. The screen updates at once; rolls back on failure. */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<AppSettings>) => {
      const current = queryClient.getQueryData<AppSettings>(settingsKey) ?? DEFAULT_SETTINGS;
      return settingsApi.update({ ...current, ...patch });
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: settingsKey });
      const previous = queryClient.getQueryData<AppSettings>(settingsKey);
      queryClient.setQueryData<AppSettings>(settingsKey, {
        ...(previous ?? DEFAULT_SETTINGS),
        ...patch,
      });
      return { previous };
    },
    onError: (_e, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(settingsKey, context.previous);
    },
    onSuccess: (saved) => queryClient.setQueryData(settingsKey, saved),
  });
}

/** 1 = Monday, 0 = Sunday (date-fns `weekStartsOn`). Monday until settings have loaded. */
export function useWeekStartsOn(): 0 | 1 {
  const { data } = useAppSettings();
  return data?.weekStartsOn === "sunday" ? 0 : 1;
}
