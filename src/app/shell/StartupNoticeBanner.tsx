import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { IconButton } from "@/components/ui/IconButton";
import { backupsApi } from "@/lib/api/backups";
import { formatWhen } from "@/lib/format";

/**
 * P1-T15: if Kairos repaired its data at startup, say so once, calmly, with what happened
 * and where the damaged file was kept. Never alarming: no red, no exclamation marks.
 */
export function StartupNoticeBanner() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  const notice = useQuery({
    queryKey: ["startupNotice"],
    queryFn: backupsApi.takeStartupNotice,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  if (dismissed || !notice.data) return null;

  const message =
    notice.data.kind === "restored"
      ? t("startup.restored", {
          when: formatWhen(notice.data.backupCreatedAt, new Date(), t),
          path: notice.data.keptAt,
        })
      : t("startup.unrecoverable", { path: notice.data.keptAt });

  return (
    <div
      role="status"
      className="mb-6 flex items-start gap-3 rounded-md border border-border-strong bg-surface-2 p-4"
    >
      <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent-text" />
      <p className="flex-1 text-body break-words">{message}</p>
      <IconButton icon={X} label={t("common.dismiss")} onClick={() => setDismissed(true)} />
    </div>
  );
}
