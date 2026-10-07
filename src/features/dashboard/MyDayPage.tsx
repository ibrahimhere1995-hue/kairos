import { useTranslation } from "react-i18next";
import { PlaceholderPage } from "@/components/PlaceholderPage";

// Filled in by P1-T08 (My Day dashboard).
export function MyDayPage() {
  const { t } = useTranslation();
  return <PlaceholderPage title={t("nav.myDay")} description={t("pages.myDay")} />;
}
