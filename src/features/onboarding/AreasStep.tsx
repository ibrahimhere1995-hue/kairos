import { useTranslation } from "react-i18next";
import { AreaDot } from "@/components/AreaDot";
import type { Area } from "@/types/Area";

/** Step 3: life areas, all ticked; unticked ones are archived (never deleted). */
export function AreasStep({
  areas,
  kept,
  onToggle,
}: {
  areas: Area[];
  kept: Set<string>;
  onToggle: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="flex flex-col gap-1 pb-2">
        <span className="font-display text-h1">{t("onboarding.areasTitle")}</span>
        <span className="text-body text-text-muted">{t("onboarding.areasBody")}</span>
      </legend>
      {areas.map((area) => (
        <label
          key={area.id}
          className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-surface-2 px-3 py-2"
        >
          <input
            type="checkbox"
            checked={kept.has(area.id)}
            onChange={() => onToggle(area.id)}
            className="size-4 accent-(--accent)"
          />
          <AreaDot color={area.color} />
          <span className="text-body">{area.name}</span>
        </label>
      ))}
    </fieldset>
  );
}
