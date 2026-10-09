import { Sparkles, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOnboarding, useRemoveSamples } from "@/features/onboarding/api";
import { Button } from "@/components/ui/Button";

/** PRD R7: the sample tasks are removable in one click (they go to the Trash). */
export function SamplesNote() {
  const { t } = useTranslation();
  const { data } = useOnboarding();
  const remove = useRemoveSamples();
  if (!data || data.samplesLeft === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-2 text-small text-text-muted">
      <Sparkles aria-hidden="true" className="size-4 text-accent-text" />
      {t("onboarding.samplesNote")}
      <Button size="sm" variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate()}>
        <Trash2 aria-hidden="true" />
        {t("onboarding.removeSamples")}
      </Button>
    </p>
  );
}
