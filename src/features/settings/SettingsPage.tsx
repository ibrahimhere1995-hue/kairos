import { useTranslation } from "react-i18next";
import { PlaceholderPage } from "@/components/PlaceholderPage";

// Filled in by P1-T16 (basic settings).
export function SettingsPage() {
  const { t } = useTranslation();
  return <PlaceholderPage title={t("nav.settings")} description={t("pages.settings")} />;
}
