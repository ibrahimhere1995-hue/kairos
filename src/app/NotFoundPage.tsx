import { useTranslation } from "react-i18next";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export function NotFoundPage() {
  const { t } = useTranslation();
  return <PlaceholderPage title={t("pages.notFoundTitle")} description={t("pages.notFound")} />;
}
