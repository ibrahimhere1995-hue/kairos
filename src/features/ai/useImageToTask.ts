import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { imageDraftToForm } from "@/features/ai/imageDraft";
import { useEditorStore } from "@/features/items/editorStore";
import { aiApi } from "@/lib/api/ai";
import { shrinkImage } from "@/lib/image/shrink";

/**
 * A1: shrink a picture, let the AI read it, and open the editor pre-filled.
 * Nothing is saved until the user checks the form and presses Add.
 */
export function useImageToTask(onOpened?: () => void) {
  const openNew = useEditorStore((s) => s.openNew);
  return useMutation({
    mutationFn: async (picture: Blob) => {
      const { bytes, type } = await shrinkImage(picture);
      return aiApi.extractFromImage(bytes, type, format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    },
    onSuccess: (draft) => {
      onOpened?.();
      openNew(imageDraftToForm(draft));
    },
  });
}
