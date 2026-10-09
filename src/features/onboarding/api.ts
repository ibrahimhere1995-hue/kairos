import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { areaKeys, itemKeys } from "@/features/items/queryKeys";
import { settingsKey } from "@/features/settings/api";
import { onboardingApi } from "@/lib/api/onboarding";
import { useToastStore } from "@/lib/toastStore";
import type { OnboardingInput } from "@/types/OnboardingInput";

export const onboardingKey = ["onboarding"] as const;

export function useOnboarding() {
  return useQuery({ queryKey: onboardingKey, queryFn: onboardingApi.status });
}

/** After the welcome screens: settings, areas, the sample tasks and the status all change. */
function useRefreshAll() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [onboardingKey, settingsKey, areaKeys.all, itemKeys.all].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
}

export function useFinishOnboarding() {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (input: OnboardingInput) => onboardingApi.finish(input),
    onSettled: refresh,
  });
}

export function useSkipOnboarding() {
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: onboardingApi.skip, onSettled: refresh });
}

export function useRemoveSamples() {
  const refresh = useRefreshAll();
  const { t } = useTranslation();
  const showToast = useToastStore((state) => state.show);
  return useMutation({
    mutationFn: onboardingApi.removeSamples,
    onSuccess: () => showToast({ message: t("toast.samplesRemoved") }),
    onSettled: refresh,
  });
}
