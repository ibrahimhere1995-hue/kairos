import { useTranslation } from "react-i18next";
import { PlaceholderPage } from "@/components/PlaceholderPage";

// Filled in by P3-T01 (Inbox).
export function InboxPage() {
  const { t } = useTranslation();
  return <PlaceholderPage title={t("nav.inbox")} description={t("pages.inbox")} />;
}
