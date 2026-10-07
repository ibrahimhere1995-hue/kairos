import { useState } from "react";
import { CalendarClock, CircleCheck, Trash2 } from "lucide-react";
import { FormProvider, useForm, useWatch, type FieldPath } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useDeleteItem, useSaveItem } from "@/features/items/api";
import { AreaPill } from "@/features/items/editor/AreaPill";
import { ChecklistEditor } from "@/features/items/editor/ChecklistEditor";
import { DatePill } from "@/features/items/editor/DatePill";
import { DiscardPrompt } from "@/features/items/editor/DiscardPrompt";
import { PriorityPill } from "@/features/items/editor/PriorityPill";
import { TimePill } from "@/features/items/editor/TimePill";
import {
  emptyItemForm,
  formFromDetail,
  itemFormResolver,
  toChecklistInput,
  toItemInput,
  type ItemFormValues,
} from "@/features/items/itemForm";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SidePanel } from "@/components/ui/SidePanel";
import { toErrorPayload } from "@/lib/api/errors";
import type { ItemDetail } from "@/types/ItemDetail";

/** Backend field name → editor field that shows the message. */
const SERVER_FIELDS: Record<string, FieldPath<ItemFormValues>> = {
  title: "title",
  notes: "notes",
  priority: "priority",
  areaId: "areaId",
  dueDate: "date",
  startAt: "time",
  endAt: "durationMinutes",
};

export function ItemEditorForm({
  detail,
  prefill = null,
  today,
  onClose,
}: {
  detail: ItemDetail | null;
  prefill?: Partial<ItemFormValues> | null;
  today: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const form = useForm<ItemFormValues>({
    defaultValues: detail
      ? formFromDetail(detail, today)
      : { ...emptyItemForm(today), ...(prefill ?? {}) },
    resolver: itemFormResolver,
  });
  const { register, handleSubmit, setError, setValue, getValues, control, formState } = form;
  const save = useSaveItem();
  const remove = useDeleteItem();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const kind = useWatch({ control, name: "kind" });
  const isNew = detail === null;
  // Read during render: react-hook-form only tracks formState fields that are subscribed here.
  const { isDirty, dirtyFields } = formState;

  const requestClose = () => (isDirty ? setConfirmDiscard(true) : onClose());

  const onSubmit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: detail?.item.id ?? null,
        input: toItemInput(values, detail?.item ?? null),
        checklist: toChecklistInput(values),
        checklistChanged: Boolean(dirtyFields.checklist),
      });
      onClose();
    } catch (error) {
      const payload = toErrorPayload(error);
      const field = payload.field ? SERVER_FIELDS[payload.field] : undefined;
      setError(field ?? "root.server", { message: payload.message });
    }
  });

  const titleError = formState.errors.title?.message;
  const dateError = formState.errors.date?.message ?? formState.errors.time?.message;
  const durationError = formState.errors.durationMinutes?.message;
  const serverError = formState.errors.root?.server?.message;

  return (
    <SidePanel
      open
      title={t(isNew ? "editor.newTitle" : "editor.editTitle")}
      onRequestClose={requestClose}
    >
      <FormProvider {...form}>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
            <div className="flex flex-col gap-1">
              <input
                data-autofocus
                aria-label={t("editor.title")}
                aria-invalid={titleError !== undefined}
                aria-describedby={titleError ? "title-error" : undefined}
                placeholder={t("editor.titlePlaceholder")}
                className="w-full rounded-sm border border-transparent bg-transparent px-1 py-1 text-h2 placeholder:text-text-subtle focus:border-border"
                {...register("title")}
              />
              {titleError && <FieldError id="title-error" message={t(titleError)} />}
            </div>

            <SegmentedControl
              name="item-kind"
              legend={t("editor.kind")}
              value={kind}
              onChange={(value) => {
                setValue("kind", value, { shouldDirty: true });
                // Events always have a date, and a timed event needs a length.
                const { schedule, durationMinutes } = getValues();
                if (value === "event" && schedule === "none") {
                  setValue("schedule", "date", { shouldDirty: true });
                }
                if (value === "event" && schedule === "time" && durationMinutes === 0) {
                  setValue("durationMinutes", 60, { shouldDirty: true });
                }
              }}
              options={[
                { value: "task", label: t("kind.task"), icon: CircleCheck },
                { value: "event", label: t("kind.event"), icon: CalendarClock },
              ]}
            />

            <div className="flex flex-wrap gap-2">
              <DatePill today={today} />
              <TimePill />
              <AreaPill />
              <PriorityPill />
            </div>
            {(dateError ?? durationError) && (
              <FieldError message={t(dateError ?? durationError ?? "")} />
            )}

            <ChecklistEditor />

            <details className="group flex flex-col gap-2" open={Boolean(detail?.item.notes)}>
              <summary className="cursor-pointer text-small text-text-muted">
                {t("editor.moreDetails")}
              </summary>
              <label className="mt-2 flex flex-col gap-1 text-small text-text-muted">
                {t("editor.notes")}
                <textarea
                  rows={5}
                  className="rounded-sm border border-border bg-surface-2 p-2 text-body text-text"
                  {...register("notes")}
                />
              </label>
            </details>
          </div>

          <footer className="flex shrink-0 flex-col gap-3 border-t border-border px-5 py-4">
            {serverError && <FieldError message={t(serverError)} />}
            {confirmDiscard ? (
              <DiscardPrompt onKeep={() => setConfirmDiscard(false)} onDiscard={onClose} />
            ) : (
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={save.isPending}>
                  {t(
                    isNew
                      ? kind === "event"
                        ? "editor.addEvent"
                        : "editor.addTask"
                      : "editor.save",
                  )}
                </Button>
                <Button variant="ghost" onClick={requestClose}>
                  {t("common.cancel")}
                </Button>
                {!isNew && (
                  <Button
                    variant="ghost"
                    className="ml-auto text-text-muted"
                    disabled={remove.isPending}
                    onClick={async () => {
                      await remove.mutateAsync(detail.item);
                      onClose();
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                    {t("editor.moveToTrash")}
                  </Button>
                )}
              </div>
            )}
          </footer>
        </form>
      </FormProvider>
    </SidePanel>
  );
}
