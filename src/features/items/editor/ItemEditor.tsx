import { useTranslation } from "react-i18next";
import { useItemDetail } from "@/features/items/api";
import { ItemEditorForm } from "@/features/items/editor/ItemEditorForm";
import { useEditorStore } from "@/features/items/editorStore";
import { SidePanel } from "@/components/ui/SidePanel";
import { getDayContext } from "@/lib/dates/dayContext";

/** Mounted once in the app shell; opens for a new item ("+ Add task") or an existing one. */
export function ItemEditor() {
  const { t } = useTranslation();
  const { open, itemId, close } = useEditorStore();
  const detail = useItemDetail(open ? itemId : null);
  if (!open) return null;

  const today = getDayContext().today;

  if (itemId !== null && !detail.data) {
    return (
      <SidePanel open title={t("editor.editTitle")} onRequestClose={close}>
        <div className="flex flex-col gap-3 p-5" aria-busy={detail.isPending}>
          {detail.isError ? (
            <p role="alert" className="text-body text-text-muted">
              {t("errors.notFound")}
            </p>
          ) : (
            <>
              <div className="skeleton h-8 w-3/4 rounded-sm" />
              <div className="skeleton h-9 w-1/2 rounded-sm" />
              <div className="skeleton h-24 rounded-sm" />
            </>
          )}
        </div>
      </SidePanel>
    );
  }

  return (
    <ItemEditorForm
      key={itemId ?? "new"}
      detail={itemId === null ? null : (detail.data ?? null)}
      today={today}
      onClose={close}
    />
  );
}
