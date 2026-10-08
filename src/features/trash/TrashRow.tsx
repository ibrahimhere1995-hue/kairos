import type { CSSProperties } from "react";
import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRestoreFromTrash } from "@/features/trash/api";
import { TRASH_DAYS } from "@/features/trash/trashRules";
import { Button } from "@/components/ui/Button";
import { formatWhen } from "@/lib/format";
import type { Item } from "@/types/Item";

/** A deleted item: when it was deleted, how long it stays, and Restore. */
export function TrashRow({ item, now, style }: { item: Item; now: Date; style?: CSSProperties }) {
  const { t } = useTranslation();
  const restore = useRestoreFromTrash();
  const deletedAt = item.deletedAt ?? item.updatedAt;
  const daysLeft = Math.max(
    0,
    differenceInCalendarDays(addDays(parseISO(deletedAt), TRASH_DAYS), now),
  );

  return (
    <li style={style} className={style ? "pb-2" : undefined}>
      <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body">{item.title}</span>
          <span className="truncate text-small text-text-muted">
            {t("trash.deletedWhen", { when: formatWhen(deletedAt, now, t) })} ·{" "}
            {daysLeft > 0 ? t("trash.daysLeft", { count: daysLeft }) : t("trash.goingSoon")}
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={restore.isPending}
          onClick={() => restore.mutate(item)}
          aria-label={t("trash.restoreItem", { title: item.title })}
        >
          <RotateCcw aria-hidden="true" />
          {t("trash.restore")}
        </Button>
      </div>
    </li>
  );
}
