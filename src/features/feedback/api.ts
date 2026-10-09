import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { feedbackApi, type FeedbackStatus } from "@/lib/api/feedback";
import { useToastStore } from "@/lib/toastStore";
import type { FeedbackInput } from "@/types/FeedbackInput";

const key = ["feedback"] as const;

export function useFeedback() {
  return useQuery({ queryKey: key, queryFn: feedbackApi.list });
}

export function useFeedbackActions() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const showToast = useToastStore((s) => s.show);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  return {
    create: useMutation({ mutationFn: feedbackApi.create, onSettled: refresh }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: FeedbackInput }) =>
        feedbackApi.update(id, input),
      onSettled: refresh,
    }),
    move: useMutation({
      mutationFn: ({ id, status }: { id: string; status: FeedbackStatus }) =>
        feedbackApi.setStatus(id, status),
      onSettled: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => feedbackApi.setDeleted(id, true),
      onSuccess: (_, id) =>
        showToast({
          message: t("feedback.deleted"),
          actionLabel: t("toast.undo"),
          onAction: () => void feedbackApi.setDeleted(id, false).then(refresh),
        }),
      onSettled: refresh,
    }),
  };
}
