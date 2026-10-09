import { Hourglass, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAiReady } from "@/features/ai/api";
import { usePlanStore } from "@/features/ai/plan/planStore";
import type { Overload } from "@/features/dashboard/overload";
import { friendlyDuration } from "@/features/items/editor/friendlyDate";
import { Button } from "@/components/ui/Button";

/** A4: a calm note when today holds more than the time left, with an offer to lighten it. */
export function OverbookedCard({ load }: { load: Overload }) {
  const { t } = useTranslation();
  const aiReady = useAiReady();
  const openPlan = usePlanStore((s) => s.openPlan);
  const time = (m: number) => (m > 0 ? friendlyDuration(m, t) : t("dates.hours", { count: 0 }));

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface p-4">
      <Hourglass aria-hidden="true" className="size-5 text-accent-text" />
      <p className="min-w-60 flex-1 text-body">
        {t("overload.text", { planned: time(load.planned), free: time(load.free) })}{" "}
        <span className="text-text-muted">{t(aiReady ? "overload.offer" : "overload.hint")}</span>
      </p>
      {aiReady && (
        <Button variant="secondary" onClick={() => openPlan("lighten")}>
          <Sparkles aria-hidden="true" />
          {t("overload.suggest")}
        </Button>
      )}
    </section>
  );
}
