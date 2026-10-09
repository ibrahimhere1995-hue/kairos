import { useMemo } from "react";
import { Inbox, Plus, RotateCcw } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import { useInboxEntries } from "@/features/inbox/api";
import { InboxCapture } from "@/features/inbox/InboxCapture";
import { InboxEntryCard } from "@/features/inbox/InboxEntryCard";
import { useAreas, useUnscheduledItems } from "@/features/items/api";
import { useEditorStore } from "@/features/items/editorStore";
import { ItemRow } from "@/features/items/ItemRow";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { getDayContext } from "@/lib/dates/dayContext";

const SKELETON = (
  <div aria-busy="true" className="flex flex-col gap-2">
    <div className="skeleton h-14 rounded-md" />
    <div className="skeleton h-14 rounded-md" />
  </div>
);

/**
 * PRD R18 / §6: the Inbox holds quick notes and pictures (each becomes a task in one click)
 * and every task without a date. Voice notes arrive with P3-T14.
 */
export function InboxPage() {
  const { t } = useTranslation();
  const entries = useInboxEntries();
  const items = useUnscheduledItems();
  const { data: areaList = [] } = useAreas();
  const areas = useMemo(() => new Map(areaList.map((a) => [a.id, a])), [areaList]);
  const openNew = useEditorStore((s) => s.openNew);
  const today = getDayContext().today;
  const failed = entries.isError || items.isError;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-h1">{t("nav.inbox")}</h1>
        <p className="text-text-muted">{t("inbox.intro")}</p>
      </header>

      {failed ? (
        <EmptyState
          icon={RotateCcw}
          message={t("errors.database")}
          action={
            <Button onClick={() => void Promise.all([entries.refetch(), items.refetch()])}>
              {t("common.tryAgain")}
            </Button>
          }
        />
      ) : (
        <>
          <section aria-labelledby="inbox-notes" className="flex flex-col gap-3">
            <h2 id="inbox-notes" className="text-h2">
              {t("inbox.notes")}
            </h2>
            <InboxCapture />
            {entries.isPending
              ? SKELETON
              : entries.data.length > 0 && (
                  <ul className="flex flex-col gap-2" aria-label={t("inbox.notes")}>
                    <AnimatePresence initial={false}>
                      {entries.data.map((entry) => (
                        <InboxEntryCard key={entry.id} entry={entry} />
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
          </section>

          <section aria-labelledby="inbox-tasks" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="inbox-tasks" className="text-h2">
                {t("inbox.tasks")}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openNew({ kind: "task", schedule: "none" })}
              >
                <Plus aria-hidden="true" />
                {t("inbox.add")}
              </Button>
            </div>
            {items.isPending ? (
              SKELETON
            ) : items.data.length === 0 ? (
              <EmptyState icon={Inbox} message={t("inbox.empty")} />
            ) : (
              <ul className="flex flex-col gap-2" aria-label={t("inbox.tasks")}>
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
          </section>
        </>
      )}
    </div>
  );
}
