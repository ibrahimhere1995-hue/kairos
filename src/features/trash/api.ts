import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { itemKeys } from "@/features/items/queryKeys";
import { trashApi } from "@/lib/api/backups";
import { itemsApi } from "@/lib/api/items";
import { useToastStore } from "@/lib/toastStore";
import type { Item } from "@/types/Item";

export const trashKey = ["items", "trash"] as const; // under "items" so item changes refresh it

export function useTrash() {
  return useQuery({ queryKey: trashKey, queryFn: trashApi.list });
}

export function useRestoreFromTrash() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const showToast = useToastStore((state) => state.show);
  return useMutation({
    mutationFn: (item: Item) => itemsApi.restore(item.id),
    onSuccess: (_, item) => showToast({ message: t("trash.restored", { title: item.title }) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: itemKeys.all }),
  });
}

export function useEmptyTrash() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const showToast = useToastStore((state) => state.show);
  return useMutation({
    mutationFn: trashApi.empty,
    onSuccess: () => showToast({ message: t("trash.emptied") }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: itemKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["backups"] });
    },
  });
}
