import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { goalsApi } from "@/lib/api/goals";
import { useToastStore } from "@/lib/toastStore";
import type { GoalInput } from "@/types/GoalInput";

export const goalKeys = { all: ["goals"] as const };

export function useGoals() {
  return useQuery({ queryKey: goalKeys.all, queryFn: goalsApi.list });
}

export function useGoalActions() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const showToast = useToastStore((s) => s.show);
  const refresh = () => queryClient.invalidateQueries({ queryKey: goalKeys.all });
  return {
    create: useMutation({
      mutationFn: (input: GoalInput) => goalsApi.create(input),
      onSettled: refresh,
    }),
    achieve: useMutation({
      mutationFn: ({ id, achieved }: { id: string; achieved: boolean }) =>
        goalsApi.achieve(id, achieved),
      onSettled: refresh,
    }),
    addMilestone: useMutation({
      mutationFn: ({ goalId, title }: { goalId: string; title: string }) =>
        goalsApi.addMilestone(goalId, title),
      onSettled: refresh,
    }),
    removeMilestone: useMutation({
      mutationFn: (id: string) => goalsApi.setMilestoneDeleted(id, true),
      onSettled: refresh,
    }),
    remove: useMutation({
      mutationFn: ({ id }: { id: string; title: string }) => goalsApi.setDeleted(id, true),
      onSuccess: (_, { id, title }) =>
        showToast({
          message: t("goals.deleted", { title }),
          actionLabel: t("toast.undo"),
          onAction: () => void goalsApi.setDeleted(id, false).then(refresh),
        }),
      onSettled: refresh,
    }),
  };
}
