import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { itemKeys } from "@/features/items/queryKeys";
import { templatesApi } from "@/lib/api/goals";
import { useToastStore } from "@/lib/toastStore";

const key = ["templates"] as const;

export function useTemplates() {
  return useQuery({ queryKey: key, queryFn: templatesApi.list });
}

export function useTemplateActions() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const showToast = useToastStore((s) => s.show);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const refreshItems = () => queryClient.invalidateQueries({ queryKey: itemKeys.all });
  return {
    create: useMutation({
      mutationFn: ({ name, itemIds }: { name: string; itemIds: string[] }) =>
        templatesApi.create(name, itemIds),
      onSettled: refresh,
    }),
    /** Inserts the items, with Undo (they go to the Trash). */
    apply: useMutation({
      mutationFn: ({ id, date }: { id: string; date: string }) => templatesApi.apply(id, date),
      onSuccess: (items) =>
        showToast({
          message: t("templates.inserted", { count: items.length }),
          actionLabel: t("toast.undo"),
          onAction: () => void templatesApi.deleteItems(items.map((i) => i.id)).then(refreshItems),
        }),
      onSettled: refreshItems,
    }),
    remove: useMutation({
      mutationFn: ({ id }: { id: string; name: string }) => templatesApi.setDeleted(id, true),
      onSuccess: (_, { id, name }) =>
        showToast({
          message: t("templates.deleted", { name }),
          actionLabel: t("toast.undo"),
          onAction: () => void templatesApi.setDeleted(id, false).then(refresh),
        }),
      onSettled: refresh,
    }),
  };
}
