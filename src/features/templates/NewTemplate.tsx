import { useMemo, useState, type FormEvent } from "react";
import { addDays, parseISO } from "date-fns";
import { useTranslation } from "react-i18next";
import { rangeForDays } from "@/features/calendar/calendarView";
import { useItemsInRange } from "@/features/items/api";
import { useTemplateActions } from "@/features/templates/api";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { toErrorPayload } from "@/lib/api/errors";
import { getDayContext, toLocalDateString } from "@/lib/dates/dayContext";

const FIELD = "h-10 rounded-sm border border-border bg-surface-2 px-3 text-body text-text";

/** Save items from a few days (e.g. a typical week's start) as a template. */
export function NewTemplate() {
  const { t } = useTranslation();
  const { create } = useTemplateActions();
  const [from, setFrom] = useState(getDayContext().today);
  const [days, setDays] = useState(1);
  const [name, setName] = useState("");
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const range = useMemo(
    () =>
      rangeForDays(
        Array.from({ length: days }, (_, i) => toLocalDateString(addDays(parseISO(from), i))),
      ),
    [from, days],
  );
  const items = useItemsInRange(range);
  const chosen = (items.data ?? []).filter((i) => !unticked.has(i.id));

  const save = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { name, itemIds: chosen.map((i) => i.id) },
      { onSuccess: () => (setName(""), setUnticked(new Set())) },
    );
  };

  return (
    <form
      onSubmit={save}
      aria-labelledby="new-template"
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
    >
      <h2 id="new-template" className="text-h3">
        {t("templates.new")}
      </h2>
      <div className="flex flex-wrap gap-2">
        <label className="flex items-center gap-2 text-small text-text-muted">
          {t("templates.from")}
          <input
            type="date"
            value={from}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
            className={FIELD}
          />
        </label>
        <label className="flex items-center gap-2 text-small text-text-muted">
          {t("templates.days")}
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={FIELD}>
            {[1, 2, 3, 5, 7].map((n) => (
              <option key={n} value={n}>
                {t("templates.dayCount", { count: n })}
              </option>
            ))}
          </select>
        </label>
      </div>
      {items.data && items.data.length === 0 ? (
        <p className="text-small text-text-muted">{t("templates.nothingThere")}</p>
      ) : (
        <ul className="flex flex-col gap-1" aria-label={t("templates.choose")}>
          {(items.data ?? []).map((item) => (
            <li key={item.id}>
              <label className="flex items-center gap-2 text-body">
                <input
                  type="checkbox"
                  checked={!unticked.has(item.id)}
                  onChange={() =>
                    setUnticked((prev) => {
                      const next = new Set(prev);
                      if (next.has(item.id)) next.delete(item.id);
                      else next.add(item.id);
                      return next;
                    })
                  }
                  className="size-4 accent-(--accent)"
                />
                {item.title}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <input
            value={name}
            maxLength={100}
            aria-label={t("templates.name")}
            placeholder={t("templates.namePlaceholder")}
            onChange={(e) => setName(e.target.value)}
            className={FIELD}
          />
          {create.error && <FieldError message={t(toErrorPayload(create.error).message)} />}
        </div>
        <Button
          type="submit"
          variant="secondary"
          disabled={chosen.length === 0 || create.isPending}
        >
          {t("templates.save", { count: chosen.length })}
        </Button>
      </div>
    </form>
  );
}
