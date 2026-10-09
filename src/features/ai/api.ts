import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiApi } from "@/lib/api/ai";

const key = ["ai"] as const;

export function useAiStatus() {
  return useQuery({ queryKey: key, queryFn: aiApi.status });
}

/** Smart features can run: consent given and a key saved. */
export function useAiReady(): boolean {
  const { data } = useAiStatus();
  return Boolean(data?.consented && data.hasKey);
}

export function useAiActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  return {
    consent: useMutation({ mutationFn: aiApi.consent, onSettled: refresh }),
    setKey: useMutation({ mutationFn: aiApi.setKey, onSettled: refresh }),
    clearKey: useMutation({ mutationFn: aiApi.clearKey, onSettled: refresh }),
  };
}
