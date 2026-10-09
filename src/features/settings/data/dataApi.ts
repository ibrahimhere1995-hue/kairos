import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { itemKeys } from "@/features/items/queryKeys";
import { dataApi } from "@/lib/api/data";
import { toErrorPayload } from "@/lib/api/errors";
import { pickFile, pickSavePath } from "@/lib/api/files";
import { useToastStore } from "@/lib/toastStore";

const stamp = () => format(new Date(), "yyyy-MM-dd");

/** Settings › Your data (P2-T12): export JSON / .ics, import .ics. Each reports in a toast. */
export function useDataActions() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  const fail = (error: unknown) => {
    const message = toErrorPayload(error).message;
    showToast({ message: message === "errors.unknown" ? t("data.failed") : t(message) });
  };

  const exportJson = useMutation({
    mutationFn: async () => {
      const path = await pickSavePath(t("data.saveJsonTitle"), `kairos-${stamp()}.json`, "json");
      if (path) await dataApi.exportJson(path);
      return path;
    },
    onSuccess: (path) => path && showToast({ message: t("data.exported", { path }) }),
    onError: fail,
  });

  const exportIcs = useMutation({
    mutationFn: async () => {
      const path = await pickSavePath(t("data.saveIcsTitle"), `kairos-${stamp()}.ics`, "ics");
      return path ? { path, count: await dataApi.exportIcs(path) } : null;
    },
    onSuccess: (done) =>
      done && showToast({ message: t("data.exportedIcs", { count: done.count, path: done.path }) }),
    onError: fail,
  });

  const importIcs = useMutation({
    mutationFn: async () => {
      const path = await pickFile(t("data.openIcsTitle"), ["ics"]);
      return path ? dataApi.importIcs(path) : null;
    },
    onSuccess: (summary) => {
      if (!summary) return;
      const headline =
        summary.imported > 0
          ? t("data.imported", { count: summary.imported })
          : t("data.importedNone");
      const extra = summary.duplicates + summary.skipped + summary.simplified > 0;
      showToast({ message: extra ? `${headline} ${t("data.importDetails", summary)}` : headline });
    },
    onError: fail,
    onSettled: () => queryClient.invalidateQueries({ queryKey: itemKeys.all }),
  });

  return { exportJson, exportIcs, importIcs };
}
