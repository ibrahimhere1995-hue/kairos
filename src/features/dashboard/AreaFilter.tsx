import { useTranslation } from "react-i18next";
import { AreaDot } from "@/components/AreaDot";
import { cn } from "@/lib/utils";
import type { Area } from "@/types/Area";

const chip =
  "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-small transition-colors duration-(--dur-fast)";

/** One-click life-area filter (PRD R2). Single choice; "All areas" clears it. */
export function AreaFilter({
  areas,
  value,
  onChange,
}: {
  areas: Area[];
  value: string | null;
  onChange: (areaId: string | null) => void;
}) {
  const { t } = useTranslation();
  const style = (selected: boolean) =>
    cn(
      chip,
      selected
        ? "border-border-strong bg-surface font-semibold"
        : "border-border bg-surface-2 hover:bg-surface-3",
    );

  return (
    <div role="group" aria-label={t("myDay.filterLabel")} className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={value === null}
        className={style(value === null)}
        onClick={() => onChange(null)}
      >
        {t("myDay.allAreas")}
      </button>
      {areas.map((area) => (
        <button
          key={area.id}
          type="button"
          aria-pressed={value === area.id}
          className={style(value === area.id)}
          onClick={() => onChange(value === area.id ? null : area.id)}
        >
          <AreaDot color={area.color} />
          {area.name}
        </button>
      ))}
    </div>
  );
}
