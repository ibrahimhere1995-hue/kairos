import { useState } from "react";
import { CalendarClock, CircleCheck } from "lucide-react";
import { FormProvider, useForm, useWatch, type FieldPath } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useDeleteItem, useSaveItem } from "@/features/items/api";
import { AreaPill } from "@/features/items/editor/AreaPill";
import { ChecklistEditor } from "@/features/items/editor/ChecklistEditor";
import { DatePill } from "@/features/items/editor/DatePill";
import { useFocusStore } from "@/features/focus/focusStore";
import { EditorFooter } from "@/features/items/editor/EditorFooter";
import { MoreDetails } from "@/features/items/editor/MoreDetails";
import { GoalPill } from "@/features/items/editor/GoalPill";
import { PriorityPill } from "@/features/items/editor/PriorityPill";
import { RepeatPill } from "@/features/items/editor/RepeatPill";
import { ReminderPill } from "@/features/items/editor/ReminderPill";
import { TimePill } from "@/features/items/editor/TimePill";
import {
  emptyItemForm,
  formFromDetail,
  itemFormResolver,
  toChecklistInput,
  toItemInput,
  type ItemFormValues,
} from "@/features/items/itemForm";
import { FieldError } from "@/components/ui/FieldError";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SidePanel } from "@/components/ui/SidePanel";
import { toErrorPayload } from "@/lib/api/errors";
import type { EditScope } from "@/types/EditScope";
import type { Item } from "@/types/Item";
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
  focusSteps = false,
  today,
  onClose,
}: {
  detail: ItemDetail | null;
  prefill?: Partial<ItemFormValues> | null;
  focusSteps?: boolean;
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

  const openFocus = useFocusStore((s) => s.openFocus);
  const startFocus = (item: Item) => {
    onClose();
    openFocus(item);
  };
  const requestClose = () => (isDirty ? setConfirmDiscard(true) : onClose());

  // A repeating item asks "only this one or this and following?" before saving or trashing.
  const repeating =
    detail !== null && (detail.item.rrule !== null || detail.item.recurrenceParentId !== null);
  const [scopeFor, setScopeFor] = useState<"save" | "delete" | null>(null);

  const saveWith = async (values: ItemFormValues, scope?: EditScope) => {
    try {
      await save.mutateAsync({
        id: detail?.item.id ?? null,
        input: toItemInput(values, detail?.item ?? null),
        checklist: toChecklistInput(values),
        checklistChanged: Boolean(dirtyFields.checklist),
        scope,
      });
      onClose();
    } catch (error) {
      const payload = toErrorPayload(error);
      const field = payload.field ? SERVER_FIELDS[payload.field] : undefined;
      setError(field ?? "root.server", { message: payload.message });
    }
  };
  const onSubmit = handleSubmit((values) => (repeating ? setScopeFor("save") : saveWith(values)));
  const trash = async (scope?: EditScope) => {
    if (!detail) return;
    await remove.mutateAsync({ item: detail.item, scope });
    onClose();
  };

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
              <ReminderPill />
              <RepeatPill />
              <AreaPill />
              <PriorityPill />
              <GoalPill />
            </div>
            {(dateError ?? durationError) && (
              <FieldError message={t(dateError ?? durationError ?? "")} />
            )}

            <ChecklistEditor autoFocus={focusSteps} />

            <MoreDetails
              itemId={detail?.item.id ?? null}
              startOpen={Boolean(detail?.item.notes ?? detail?.item.location)}
            />
          </div>

          <EditorFooter
            isNew={isNew}
            isEvent={kind === "event"}
            busy={save.isPending || remove.isPending}
            serverError={serverError}
            confirmDiscard={confirmDiscard}
            scopeFor={scopeFor}
            onKeepEditing={() => setConfirmDiscard(false)}
            onDiscard={onClose}
            onCancel={requestClose}
            onDelete={() => (repeating ? setScopeFor("delete") : void trash())}
            onChooseScope={(scope) => {
              const action = scopeFor;
              setScopeFor(null);
              if (action === "delete") void trash(scope);
              else void handleSubmit((values) => saveWith(values, scope))();
            }}
            onFocus={
              detail && kind === "task" && !detail.item.completedAt
                ? () => (isDirty ? setConfirmDiscard(true) : startFocus(detail.item))
                : undefined
            }
            onCancelScope={() => setScopeFor(null)}
          />
        </form>
      </FormProvider>
    </SidePanel>
  );
}
