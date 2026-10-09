import { useMemo } from "react";
import { Inbox, Plus, RotateCcw } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import { useAreas, useUnscheduledItems } from "@/features/items/api";
import { useEditorStore } from "@/features/items/editorStore";
import { ItemRow } from "@/features/items/ItemRow";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { getDayContext } from "@/lib/dates/dayContext";

/**
 * PRD §6: tasks without a date live in the Inbox. Give one a moment by opening it, or drag it
 * onto the calendar ("To schedule"). P3-T01 adds quick notes, images and voice here.
 */
export function InboxPage() {
  const { t } = useTranslation();
  const items = useUnscheduledItems();
  const { data: areaList = [] } = useAreas();
  const areas = useMemo(() => new Map(areaList.map((a) => [a.id, a])), [areaList]);
  const openNew = useEditorStore((s) => s.openNew);
  const today = getDayContext().today;
  const addUndated = () => openNew({ kind: "task", schedule: "none" });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-h1">{t("nav.inbox")}</h1>
          <p className="text-text-muted">{t("inbox.intro")}</p>
        </div>
        <Button variant="secondary" onClick={addUndated}>
          <Plus aria-hidden="true" />
          {t("inbox.add")}
        </Button>
      </header>

      {items.isPending ? (
        <div aria-busy="true" aria-label={t("inbox.loading")} className="flex flex-col gap-2">
          <div className="skeleton h-14 rounded-md" />
          <div className="skeleton h-14 rounded-md" />
          <div className="skeleton h-14 rounded-md" />
        </div>
      ) : items.isError ? (
        <EmptyState
          icon={RotateCcw}
          message={t("errors.database")}
          action={<Button onClick={() => void items.refetch()}>{t("common.tryAgain")}</Button>}
        />
      ) : items.data.length === 0 ? (
        <EmptyState icon={Inbox} message={t("inbox.empty")} />
      ) : (
        <ul className="flex flex-col gap-2" aria-label={t("nav.inbox")}>
          <AnimatePresence initial={false}>
            {items.data.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                status="unscheduled"
                area={item.areaId ? areas.get(item.areaId) : undefined}
                today={today}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
