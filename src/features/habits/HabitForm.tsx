import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useActiveAreas } from "@/features/items/api";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { toErrorPayload } from "@/lib/api/errors";
import type { HabitInput } from "@/types/HabitInput";

const FIELD = "h-10 rounded-sm border border-border bg-surface-2 px-3 text-body text-text";
const FREQUENCIES = ["daily", ...[1, 2, 3, 4, 5, 6].map((n) => `weekly:${n}`)];

/** Add or edit a habit: what, how often, and (optionally) its life area. */
export function HabitForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: HabitInput;
  submitLabel: string;
  onSubmit: (input: HabitInput) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const { data: areas = [] } = useActiveAreas();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [frequency, setFrequency] = useState(initial?.frequency ?? "daily");
  const [areaId, setAreaId] = useState(initial?.areaId ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({ title, frequency, areaId: areaId || null });
      if (!initial) setTitle("");
    } catch (err) {
      setError(toErrorPayload(err).message);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-start gap-2">
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <input
          value={title}
          maxLength={200}
          aria-label={t("habits.title")}
          placeholder={t("habits.titlePlaceholder")}
          onChange={(e) => setTitle(e.target.value)}
          className={FIELD}
        />
        {error && <FieldError message={t(error)} />}
      </div>
      <select
        value={frequency}
        aria-label={t("habits.howOften")}
        onChange={(e) => setFrequency(e.target.value)}
        className={FIELD}
      >
        {FREQUENCIES.map((f) => (
          <option key={f} value={f}>
            {f === "daily" ? t("habits.daily") : t("habits.weekly", { count: Number(f.slice(7)) })}
          </option>
        ))}
      </select>
      <select
        value={areaId}
        aria-label={t("editor.area")}
        onChange={(e) => setAreaId(e.target.value)}
        className={FIELD}
      >
        <option value="">{t("editor.noArea")}</option>
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <Button type="submit" variant="secondary">
        {submitLabel}
      </Button>
      {onCancel && (
        <Button variant="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      )}
    </form>
  );
}
