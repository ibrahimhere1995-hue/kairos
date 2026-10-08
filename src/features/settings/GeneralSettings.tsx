import { CalendarRange, Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TEXT_SIZES } from "@/app/theme/textSize";
import { useThemeStore } from "@/app/theme/themeStore";
import { useAppSettings, useUpdateSettings } from "@/features/settings/api";
import { SettingRow } from "@/features/settings/SettingRow";
import { ReminderTimeInput } from "@/features/settings/ReminderTimeInput";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { DEFAULT_SETTINGS } from "@/lib/api/settings";
import type { ThemePreference } from "@/types/ThemePreference";
import type { WeekStart } from "@/types/WeekStart";

/** P1-T16: appearance, calendar and reminder settings. Every change applies immediately. */
export function GeneralSettings() {
  const { t } = useTranslation();
  const { preference, textSize, setPreference, setTextSize } = useThemeStore();
  const { data } = useAppSettings();
  const update = useUpdateSettings();
  const settings = data ?? DEFAULT_SETTINGS;

  return (
    <>
      <section aria-labelledby="appearance-heading" className="flex flex-col">
        <h2 id="appearance-heading" className="text-h2">
          {t("settings.appearance")}
        </h2>
        <SettingRow label={t("theme.label")} description={t("settings.themeHelp")}>
          <SegmentedControl<ThemePreference>
            name="settings-theme"
            legend={t("theme.label")}
            value={preference}
            onChange={setPreference}
            options={[
              { value: "light", label: t("theme.light"), icon: Sun },
              { value: "dark", label: t("theme.dark"), icon: Moon },
              { value: "system", label: t("theme.system"), icon: Monitor },
            ]}
          />
        </SettingRow>
        <SettingRow label={t("settings.textSize")} description={t("settings.textSizeHelp")}>
          <SegmentedControl
            name="settings-text-size"
            legend={t("settings.textSize")}
            value={textSize}
            onChange={setTextSize}
            options={TEXT_SIZES.map((size) => ({
              value: size,
              label: t(`settings.sizes.${size}`),
            }))}
          />
        </SettingRow>
      </section>

      <section aria-labelledby="calendar-settings-heading" className="flex flex-col">
        <h2 id="calendar-settings-heading" className="text-h2">
          {t("nav.calendar")}
        </h2>
        <SettingRow label={t("settings.weekStart")} description={t("settings.weekStartHelp")}>
          <SegmentedControl<WeekStart>
            name="settings-week-start"
            legend={t("settings.weekStart")}
            value={settings.weekStartsOn}
            onChange={(weekStartsOn) => update.mutate({ weekStartsOn })}
            options={[
              { value: "monday", label: t("settings.monday"), icon: CalendarRange },
              { value: "sunday", label: t("settings.sunday"), icon: CalendarRange },
            ]}
          />
        </SettingRow>
      </section>

      <section aria-labelledby="reminder-settings-heading" className="flex flex-col">
        <h2 id="reminder-settings-heading" className="text-h2">
          {t("settings.reminders")}
        </h2>
        <SettingRow label={t("settings.reminderTime")} description={t("settings.reminderTimeHelp")}>
          <ReminderTimeInput
            key={settings.defaultReminderTime}
            saved={settings.defaultReminderTime}
            label={t("settings.reminderTime")}
            onSave={(defaultReminderTime) => update.mutate({ defaultReminderTime })}
          />
        </SettingRow>
      </section>
    </>
  );
}
