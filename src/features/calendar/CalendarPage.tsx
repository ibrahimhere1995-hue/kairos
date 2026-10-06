import { useTranslation } from "react-i18next";
import { PlaceholderPage } from "@/components/PlaceholderPage";

// Filled in by P1-T09 / P1-T10 (calendar views).
export function CalendarPage() {
  const { t } = useTranslation();
  return <PlaceholderPage title={t("nav.calendar")} description={t("pages.calendar")} />;
}
