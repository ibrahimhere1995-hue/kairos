import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppSettings, useUpdateSettings } from "@/features/settings/api";
import { SettingRow } from "@/features/settings/SettingRow";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { Switch } from "@/components/ui/Switch";
import { toErrorPayload } from "@/lib/api/errors";
import { updatesApi } from "@/lib/api/updates";

/** P4-T05: the version, the daily check (can be turned off), and installing on request. */
export function UpdatesSection() {
  const { t } = useTranslation();
  const { data: settings } = useAppSettings();
  const update = useUpdateSettings();
  const version = useQuery({ queryKey: ["appVersion"], queryFn: updatesApi.version });
  const check = useMutation({ mutationFn: updatesApi.check });
  const install = useMutation({ mutationFn: updatesApi.install });
  const error = check.error ?? install.error;

  return (
    <section aria-labelledby="updates-heading" className="flex flex-col">
      <h2 id="updates-heading" className="text-h2">
        {t("updates.title")}
      </h2>
      {version.data && (
        <p className="text-small text-text-muted">
          {t("updates.version", { version: version.data })}
        </p>
      )}
      {settings && (
        <SettingRow label={t("updates.auto")} description={t("updates.autoHelp")}>
          <Switch
            checked={settings.autoUpdateCheck}
            label={t("updates.auto")}
            onChange={(autoUpdateCheck) => update.mutate({ autoUpdateCheck })}
          />
        </SettingRow>
      )}
      <div className="flex flex-wrap items-center gap-3 py-3">
        <Button variant="secondary" disabled={check.isPending} onClick={() => check.mutate()}>
          <RefreshCw aria-hidden="true" />
          {t(check.isPending ? "updates.checking" : "updates.checkNow")}
        </Button>
        <p aria-live="polite" className="text-body">
          {check.data === null && t("updates.upToDate")}
          {check.data && t("updates.available", { version: check.data.version })}
        </p>
        {check.data && (
          <Button disabled={install.isPending} onClick={() => install.mutate()}>
            <Download aria-hidden="true" />
            {t(install.isPending ? "updates.installing" : "updates.install")}
          </Button>
        )}
      </div>
      {error && <FieldError message={t(toErrorPayload(error).message)} />}
    </section>
  );
}
