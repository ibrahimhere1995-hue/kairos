import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { attachmentsApi } from "@/lib/api/attachments";
import { pickFiles } from "@/lib/api/files";

const key = (itemId: string) => ["attachments", itemId] as const;

/** An item's attachments (P2-T11). Disabled until the item has been saved. */
export function useAttachments(itemId: string | null) {
  return useQuery({
    queryKey: key(itemId ?? ""),
    queryFn: () => attachmentsApi.list(itemId ?? ""),
    enabled: itemId !== null,
  });
}

/** Changes to an item's attachments; each refreshes its list. */
export function useAttachmentActions(itemId: string | null) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: key(itemId ?? "") });
  return {
    /** Asks for files (system picker) and copies them onto the item. */
    add: useMutation({
      mutationFn: async (pickerTitle: string) => {
        const files = await pickFiles(pickerTitle);
        if (itemId && files.length > 0) await attachmentsApi.add(itemId, files);
      },
      onSettled: refresh,
    }),
    remove: useMutation({ mutationFn: attachmentsApi.remove, onSettled: refresh }),
    open: useMutation({ mutationFn: attachmentsApi.open }),
    reveal: useMutation({ mutationFn: attachmentsApi.reveal }),
  };
}
