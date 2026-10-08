import { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNow } from "@/features/dashboard/useNow";
import { useEmptyTrash, useTrash } from "@/features/trash/api";
import { TrashRow } from "@/features/trash/TrashRow";
import { EmptyState } from "@/components/EmptyState";
import { VIRTUALIZE_AFTER, VirtualList } from "@/components/VirtualList";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/** Trash (P1-T13): restore deleted items, or empty it (with confirmation). */
export function TrashPage() {
  const { t } = useTranslation();
  const now = useNow();
  const trash = useTrash();
  const empty = useEmptyTrash();
  const [confirming, setConfirming] = useState(false);
  const items = trash.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-h1">{t("trash.title")}</h1>
          <p className="text-text-muted">{t("trash.intro")}</p>
        </div>
        {items.length > 0 && (
          <Button variant="destructive" onClick={() => setConfirming(true)}>
            <Trash2 aria-hidden="true" />
            {t("trash.empty")}
          </Button>
        )}
      </header>

      {trash.isPending && (
        <div className="flex flex-col gap-2" aria-busy="true">
          <div className="skeleton h-14 rounded-md" />
          <div className="skeleton h-14 rounded-md" />
        </div>
      )}
      {trash.isError && (
        <EmptyState
          icon={RotateCcw}
          message={t("errors.database")}
          action={<Button onClick={() => void trash.refetch()}>{t("common.tryAgain")}</Button>}
        />
      )}
      {trash.isSuccess && items.length === 0 && (
        <EmptyState icon={Trash2} message={t("trash.emptyState")} />
      )}

      {items.length > VIRTUALIZE_AFTER ? (
        <VirtualList
          items={items}
          label={t("trash.title")}
          rowHeightRem={4.25}
          heightRem={36}
          getKey={(item) => item.id}
          renderRow={(item, style) => <TrashRow item={item} now={now} style={style} />}
        />
      ) : (
        items.length > 0 && (
          <ul aria-label={t("trash.title")} className="flex flex-col gap-2">
            {items.map((item) => (
              <TrashRow key={item.id} item={item} now={now} />
            ))}
          </ul>
        )
      )}

      <ConfirmDialog
        open={confirming}
        title={t("trash.confirmTitle")}
        description={t("trash.confirmBody", { count: items.length })}
        confirmLabel={t("trash.empty")}
        destructive
        pending={empty.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => empty.mutate(undefined, { onSettled: () => setConfirming(false) })}
      />
    </div>
  );
}
