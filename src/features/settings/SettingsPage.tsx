import { useTranslation } from "react-i18next";
import { BackupsSection } from "@/features/settings/backups/BackupsSection";

/** Settings. Backups now (P1-T14); theme, text size, week start and reminders follow in P1-T16. */
export function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-h1">{t("nav.settings")}</h1>
        <p className="text-text-muted">{t("settings.intro")}</p>
      </header>
      <BackupsSection />
    </div>
  );
}
