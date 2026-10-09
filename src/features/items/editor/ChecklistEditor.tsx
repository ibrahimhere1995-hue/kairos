import { useEffect, useRef } from "react";
import { Plus, X } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { ItemFormValues } from "@/features/items/itemForm";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";

/** Sub-steps: tick, edit, remove, add. Saved with the item. */
export function ChecklistEditor({ autoFocus = false }: { autoFocus?: boolean }) {
  const { t } = useTranslation();
  const { control, register } = useFormContext<ItemFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "checklist" });
  const listRef = useRef<HTMLUListElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);

  // "Break it into smaller steps": start on "Add a step" (after the panel's own autofocus).
  useEffect(() => {
    if (!autoFocus) return;
    const timer = setTimeout(() => addRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  const addStep = () => {
    append({ stepId: null, text: "", done: false });
    // Focus the new step's text field after React renders it.
    requestAnimationFrame(() => {
      const inputs = listRef.current?.querySelectorAll<HTMLInputElement>('input[type="text"]');
      inputs?.[inputs.length - 1]?.focus();
    });
  };

  return (
    <section className="flex flex-col gap-2" aria-labelledby="checklist-heading">
      <h3 id="checklist-heading" className="text-small text-text-muted">
        {t("editor.checklist")}
      </h3>
      <ul ref={listRef} className="flex flex-col gap-1">
        {fields.map((field, index) => (
          <li key={field.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label={t("editor.stepDone", { number: index + 1 })}
              className="size-4 accent-(--accent)"
              {...register(`checklist.${index}.done`)}
            />
            <input
              type="text"
              aria-label={t("editor.stepText", { number: index + 1 })}
              placeholder={t("editor.stepPlaceholder")}
              className="h-9 min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-2 text-body hover:border-border focus:border-border"
              {...register(`checklist.${index}.text`)}
            />
            <IconButton
              icon={X}
              label={t("editor.removeStep", { number: index + 1 })}
              onClick={() => remove(index)}
            />
          </li>
        ))}
      </ul>
      <Button ref={addRef} variant="ghost" size="sm" className="self-start" onClick={addStep}>
        <Plus aria-hidden="true" />
        {t("editor.addStep")}
      </Button>
    </section>
  );
}
