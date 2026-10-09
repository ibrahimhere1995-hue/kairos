import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { habitsApi } from "@/lib/api/habits";
import { useToastStore } from "@/lib/toastStore";
import type { HabitInput } from "@/types/HabitInput";

const key = ["habits"] as const;

export function useHabits(today: string) {
  return useQuery({ queryKey: [...key, today], queryFn: () => habitsApi.list(today) });
}

export function useHabitActions(today: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const showToast = useToastStore((s) => s.show);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  return {
    create: useMutation({ mutationFn: habitsApi.create, onSettled: refresh }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: HabitInput }) => habitsApi.update(id, input),
      onSettled: refresh,
    }),
    toggleToday: useMutation({
      mutationFn: ({ id, done }: { id: string; done: boolean }) =>
        habitsApi.setDone(id, today, today, done),
      onSettled: refresh,
    }),
    remove: useMutation({
      mutationFn: ({ id }: { id: string; title: string }) => habitsApi.setDeleted(id, true),
      onSuccess: (_, { id, title }) =>
        showToast({
          message: t("habits.deleted", { title }),
          actionLabel: t("toast.undo"),
          onAction: () => void habitsApi.setDeleted(id, false).then(refresh),
        }),
      onSettled: refresh,
    }),
  };
}
