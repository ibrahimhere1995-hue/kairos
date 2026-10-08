import { useTranslation } from "react-i18next";
import { BackupsSection } from "@/features/settings/backups/BackupsSection";
import { GeneralSettings } from "@/features/settings/GeneralSettings";

/** Settings (P1-T16): appearance, calendar, reminders, backups. Everything saves as you change it. */
export function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-h1">{t("nav.settings")}</h1>
        <p className="text-text-muted">{t("settings.intro")}</p>
      </header>
      <GeneralSettings />
      <BackupsSection />
    </div>
  );
}
