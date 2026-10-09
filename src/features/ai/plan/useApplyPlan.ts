import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addMinutes } from "date-fns";
import { useTranslation } from "react-i18next";
import { itemKeys } from "@/features/items/queryKeys";
import { itemsApi } from "@/lib/api/items";
import { useToastStore } from "@/lib/toastStore";
import type { Item } from "@/types/Item";
import type { PlanProposal } from "@/types/PlanProposal";

/** Gives each accepted task its proposed time; Undo puts every one back where it was. */
export function useApplyPlan() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const showToast = useToastStore((s) => s.show);
  const refresh = () => queryClient.invalidateQueries({ queryKey: itemKeys.all });

  return useMutation({
    mutationFn: async ({ accepted, items }: { accepted: PlanProposal[]; items: Item[] }) => {
      const before: Item[] = [];
      for (const p of accepted) {
        const item = items.find((i) => i.id === p.taskId);
        if (!item) continue;
        const start = new Date(`${p.date}T${p.start}`); // local wall-clock
        await itemsApi.reschedule(item.id, {
          startAt: start.toISOString(),
          endAt: addMinutes(start, p.durationMinutes).toISOString(),
          dueDate: null,
        });
        before.push(item);
      }
      return before;
    },
    onSuccess: (before) =>
      showToast({
        message: t("plan.applied", { count: before.length }),
        actionLabel: t("toast.undo"),
        onAction: () =>
          void Promise.all(
            before.map((i) =>
              itemsApi.reschedule(i.id, { startAt: i.startAt, endAt: i.endAt, dueDate: i.dueDate }),
            ),
          ).then(refresh),
      }),
    onSettled: refresh,
  });
}
