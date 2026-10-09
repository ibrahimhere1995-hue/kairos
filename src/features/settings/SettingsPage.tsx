import { useTranslation } from "react-i18next";
import { SmartFeaturesSection } from "@/features/settings/ai/SmartFeaturesSection";
import { AreasSettings } from "@/features/settings/areas/AreasSettings";
import { BackupsSection } from "@/features/settings/backups/BackupsSection";
import { DataSection } from "@/features/settings/data/DataSection";
import { GeneralSettings } from "@/features/settings/GeneralSettings";

/** Settings: appearance, calendar, reminders, startup, life areas, smart features, backups, your data. Everything saves as you change it. */
export function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-h1">{t("nav.settings")}</h1>
        <p className="text-text-muted">{t("settings.intro")}</p>
      </header>
      <GeneralSettings />
      <AreasSettings />
      <SmartFeaturesSection />
      <BackupsSection />
      <DataSection />
    </div>
  );
}
