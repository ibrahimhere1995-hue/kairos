import { useTranslation } from "react-i18next";
import { useUpdateSettings } from "@/features/settings/api";
import { ReminderTimeInput } from "@/features/settings/ReminderTimeInput";
import { SettingRow } from "@/features/settings/SettingRow";
import { toErrorPayload } from "@/lib/api/errors";
import { useToastStore } from "@/lib/toastStore";
import type { AppSettings } from "@/types/AppSettings";

/** The hours Plan my day and the "today looks full" check use (P3-T12). */
export function WorkHoursSetting({ settings }: { settings: AppSettings }) {
  const { t } = useTranslation();
  const update = useUpdateSettings();
  const showToast = useToastStore((s) => s.show);
  const save = (patch: Partial<AppSettings>) =>
    update.mutate(patch, {
      onError: (e) => showToast({ message: t(toErrorPayload(e).message) }),
    });

  return (
    <SettingRow label={t("settings.workHours")} description={t("settings.workHoursHelp")}>
      <div className="flex items-center gap-2">
        <ReminderTimeInput
          key={`s-${settings.workDayStart}`}
          saved={settings.workDayStart}
          label={t("settings.workStart")}
          onSave={(workDayStart) => save({ workDayStart })}
        />
        <span aria-hidden="true">–</span>
        <ReminderTimeInput
          key={`e-${settings.workDayEnd}`}
          saved={settings.workDayEnd}
          label={t("settings.workEnd")}
          onSave={(workDayEnd) => save({ workDayEnd })}
        />
      </div>
    </SettingRow>
  );
}
