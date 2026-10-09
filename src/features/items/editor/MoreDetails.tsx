import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { AttachmentsSection } from "@/features/items/editor/AttachmentsSection";
import type { ItemFormValues } from "@/features/items/itemForm";

const FIELD = "rounded-sm border border-border bg-surface-2 px-2 text-body text-text";

/** DESIGN_SYSTEM §7: location, notes and attachments live under "More details". */
export function MoreDetails({ itemId, startOpen }: { itemId: string | null; startOpen: boolean }) {
  const { t } = useTranslation();
  const { register } = useFormContext<ItemFormValues>();
  return (
    <details className="group flex flex-col gap-2" open={startOpen}>
      <summary className="cursor-pointer text-small text-text-muted">
        {t("editor.moreDetails")}
      </summary>
      <div className="mt-2 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-small text-text-muted">
          {t("editor.location")}
          <input
            type="text"
            maxLength={500}
            placeholder={t("editor.locationPlaceholder")}
            className={`h-9 ${FIELD}`}
            {...register("location")}
          />
        </label>
        <label className="flex flex-col gap-1 text-small text-text-muted">
          {t("editor.notes")}
          <textarea rows={5} className={`py-2 ${FIELD}`} {...register("notes")} />
        </label>
        <AttachmentsSection itemId={itemId} />
      </div>
    </details>
  );
}
