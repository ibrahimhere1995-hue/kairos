import { RotateCcw, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAiActions, useAiStatus } from "@/features/ai/api";
import { AiConsent } from "@/features/settings/ai/AiConsent";
import { AiKeyRow } from "@/features/settings/ai/AiKeyRow";
import { Button } from "@/components/ui/Button";
import { useToastStore } from "@/lib/toastStore";

/**
 * PRD §7.3 / P3-T08: smart features are off until the user agrees to the consent screen
 * and adds their own Gemini key.
 */
export function SmartFeaturesSection() {
  const { t } = useTranslation();
  const status = useAiStatus();
  const { consent } = useAiActions();
  const showToast = useToastStore((s) => s.show);

  let body;
  if (status.isPending) {
    body = <div aria-busy="true" className="skeleton h-20 rounded-md" />;
  } else if (status.isError) {
    body = (
      <Button variant="secondary" className="self-start" onClick={() => void status.refetch()}>
        <RotateCcw aria-hidden="true" />
        {t("common.tryAgain")}
      </Button>
    );
  } else if (!status.data.consented) {
    body = <AiConsent />;
  } else {
    body = (
      <>
        <AiKeyRow hasKey={status.data.hasKey} />
        <Button
          variant="ghost"
          className="self-start"
          onClick={() =>
            consent.mutate(false, {
              onSuccess: () => showToast({ message: t("ai.turnedOff") }),
            })
          }
        >
          {t("ai.turnOff")}
        </Button>
      </>
    );
  }

  const state = !status.data?.consented ? "off" : status.data.hasKey ? "on" : "needsKey";
  return (
    <section aria-labelledby="ai-heading" className="flex flex-col gap-3">
      <h2 id="ai-heading" className="inline-flex items-center gap-2 text-h2">
        <Sparkles aria-hidden="true" className="size-5 text-accent-text" />
        {t("ai.title")}
        <span className="text-small font-normal text-text-muted">· {t(`ai.status.${state}`)}</span>
      </h2>
      <p className="text-small text-text-muted">{t("ai.intro")}</p>
      {body}
    </section>
  );
}
