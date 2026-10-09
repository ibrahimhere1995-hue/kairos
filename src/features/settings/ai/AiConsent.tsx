import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAiActions } from "@/features/ai/api";
import { Button } from "@/components/ui/Button";

/** The one-time consent screen (PRD §7.3): what is sent, where the key lives, nothing auto-saves. */
export function AiConsent() {
  const { t } = useTranslation();
  const { consent } = useAiActions();
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <h3 className="inline-flex items-center gap-2 text-h3">
        <ShieldCheck aria-hidden="true" className="size-5 text-accent-text" />
        {t("ai.consentTitle")}
      </h3>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-body">
        <li>{t("ai.consentData")}</li>
        <li>{t("ai.consentKey")}</li>
        <li>{t("ai.consentConfirm")}</li>
      </ul>
      <Button
        className="self-start"
        disabled={consent.isPending}
        onClick={() => consent.mutate(true)}
      >
        {t("ai.consentAgree")}
      </Button>
    </div>
  );
}
