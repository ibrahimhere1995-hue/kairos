import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { itemKeys } from "@/features/items/queryKeys";
import { pickFile } from "@/lib/api/files";
import { inboxApi } from "@/lib/api/inbox";
import { useToastStore } from "@/lib/toastStore";
import type { InboxEntry } from "@/types/InboxEntry";

const key = ["inbox"] as const;

export function useInboxEntries() {
  return useQuery({ queryKey: key, queryFn: inboxApi.list });
}

export function useInboxImage(id: string, enabled: boolean) {
  return useQuery({
    queryKey: [...key, "image", id],
    queryFn: () => inboxApi.image(id),
    enabled,
    staleTime: Infinity,
  });
}

/** Adding, turning into tasks and deleting (with Undo). Each refreshes the list. */
export function useInboxActions() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const showToast = useToastStore((s) => s.show);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  return {
    addText: useMutation({ mutationFn: inboxApi.addText, onSettled: refresh }),
    addImage: useMutation({
      mutationFn: ({ bytes, type }: { bytes: Uint8Array; type: string }) =>
        inboxApi.addImage(bytes, type),
      onSettled: refresh,
    }),
    pickImage: useMutation({
      mutationFn: async (title: string) => {
        const path = await pickFile(title, ["png", "jpg", "jpeg", "gif", "webp"]);
        if (path) await inboxApi.addImageFile(path);
      },
      onSettled: refresh,
    }),
    process: useMutation({
      mutationFn: (entry: InboxEntry) => inboxApi.process(entry.id),
      onSuccess: (item) => showToast({ message: t("inbox.madeTask", { title: item.title }) }),
      onSettled: () => {
        void refresh();
        void queryClient.invalidateQueries({ queryKey: itemKeys.all });
      },
    }),
    remove: useMutation({
      mutationFn: (entry: InboxEntry) => inboxApi.setDeleted(entry.id, true),
      onSuccess: (_, entry) =>
        showToast({
          message: t("inbox.deleted"),
          actionLabel: t("toast.undo"),
          onAction: () => void inboxApi.setDeleted(entry.id, false).then(refresh),
        }),
      onSettled: refresh,
    }),
  };
}
