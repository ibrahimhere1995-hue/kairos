import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { Download, Sparkles, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { toErrorPayload } from "@/lib/api/errors";
import { UPDATE_AVAILABLE, updatesApi } from "@/lib/api/updates";
import type { UpdateInfo } from "@/types/UpdateInfo";

/** P4-T05: a calm note when a newer Kairos is ready; it installs only when asked. */
export function UpdateBanner() {
  const { t } = useTranslation();
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const install = useMutation({ mutationFn: updatesApi.install });

  useEffect(() => {
    const off = listen<UpdateInfo>(UPDATE_AVAILABLE, (e) => setUpdate(e.payload));
    // Stopping can fail if the window is already closing; nothing to clean up then.
    return () => void off.then((stop) => stop()).catch(() => undefined);
  }, []);

  if (!update) return null;
  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface p-4"
    >
      <Sparkles aria-hidden="true" className="size-5 text-accent-text" />
      <p className="min-w-60 flex-1 text-body">
        {t("updates.ready", { version: update.version })}
        {install.error && (
          <span className="block text-small text-text-muted">
            {t(toErrorPayload(install.error).message)}
          </span>
        )}
      </p>
      <Button disabled={install.isPending} onClick={() => install.mutate()}>
        <Download aria-hidden="true" />
        {t(install.isPending ? "updates.installing" : "updates.install")}
      </Button>
      <IconButton icon={X} label={t("updates.later")} onClick={() => setUpdate(null)} />
    </div>
  );
}
