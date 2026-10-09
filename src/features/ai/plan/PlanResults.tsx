import { useState } from "react";
import { addMinutes, format, parseISO } from "date-fns";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import type { Item } from "@/types/Item";
import type { PlanProposal } from "@/types/PlanProposal";

/** The proposed slots, all ticked: accept all, some (untick) or none. */
export function PlanResults({
  proposals,
  items,
  busy,
  onAccept,
  onNone,
}: {
  proposals: PlanProposal[];
  items: Item[];
  busy: boolean;
  onAccept: (accepted: PlanProposal[]) => void;
  onNone: () => void;
}) {
  const { t } = useTranslation();
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const accepted = proposals.filter((p) => !skipped.has(p.taskId));

  if (proposals.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-body">{t("plan.noSlots")}</p>
        <Button variant="secondary" className="self-start" onClick={onNone}>
          {t("common.close")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-small text-text-muted">{t("plan.check")}</p>
      <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
        {proposals.map((p) => {
          const start = parseISO(`${p.date}T${p.start}`);
          const when = `${format(start, "EEE d MMM, p")}–${format(addMinutes(start, p.durationMinutes), "p")}`;
          const title = items.find((i) => i.id === p.taskId)?.title ?? "";
          return (
            <li key={p.taskId}>
              <label className="flex items-start gap-3 rounded-sm px-2 py-1.5 hover:bg-surface-2">
                <input
                  type="checkbox"
                  checked={!skipped.has(p.taskId)}
                  onChange={(e) =>
                    setSkipped((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.delete(p.taskId);
                      else next.add(p.taskId);
                      return next;
                    })
                  }
                  className="mt-1 size-4 accent-accent"
                />
                <span className="flex flex-col">
                  <span className="text-body">{title}</span>
                  <span className="text-small text-text-muted">{when}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onNone}>
          {t("plan.none")}
        </Button>
        <Button disabled={busy || accepted.length === 0} onClick={() => onAccept(accepted)}>
          {t("plan.accept", { count: accepted.length })}
        </Button>
      </div>
    </div>
  );
}
