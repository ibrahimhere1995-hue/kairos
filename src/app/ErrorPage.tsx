import { useTranslation } from "react-i18next";
import { PlaceholderPage } from "@/components/PlaceholderPage";

/** Shown if a screen crashes, instead of a blank window. */
export function ErrorPage() {
  const { t } = useTranslation();
  return <PlaceholderPage title={t("pages.errorTitle")} description={t("errors.unknown")} />;
}
