import { useState } from "react";
import { CopyPlus, LayoutTemplate, RotateCcw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NewTemplate } from "@/features/templates/NewTemplate";
import { useTemplateActions, useTemplates } from "@/features/templates/api";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { getDayContext } from "@/lib/dates/dayContext";
import type { Template } from "@/types/Template";

const FIELD = "h-9 rounded-sm border border-border bg-surface-2 px-2 text-body text-text";

function TemplateRow({ template }: { template: Template }) {
  const { t } = useTranslation();
  const { apply, remove } = useTemplateActions();
  const [date, setDate] = useState(getDayContext().today);
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-3">
      <div className="flex min-w-40 flex-1 flex-col">
        <span className="text-body">{template.name}</span>
        <span className="text-small text-text-muted">
          {t("templates.items", { count: template.entries.length })}
        </span>
      </div>
      <label className="flex items-center gap-2 text-small text-text-muted">
        {t("templates.startOn")}
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={FIELD}
        />
      </label>
      <Button
        size="sm"
        variant="secondary"
        disabled={!date || apply.isPending}
        onClick={() => apply.mutate({ id: template.id, date })}
      >
        <CopyPlus aria-hidden="true" />
        {t("templates.insert")}
      </Button>
      <IconButton
        icon={Trash2}
        label={t("templates.delete", { name: template.name })}
        onClick={() => remove.mutate({ id: template.id, name: template.name })}
      />
    </li>
  );
}

/** PRD R15: save a set of items as a template and insert it relative to a chosen day. */
export function TemplatesPage() {
  const { t } = useTranslation();
  const templates = useTemplates();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-h1">{t("nav.templates")}</h1>
        <p className="text-text-muted">{t("templates.intro")}</p>
      </header>
      <NewTemplate />
      {templates.isPending ? (
        <div aria-busy="true" className="skeleton h-16 rounded-md" />
      ) : templates.isError ? (
        <EmptyState
          icon={RotateCcw}
          message={t("errors.database")}
          action={<Button onClick={() => void templates.refetch()}>{t("common.tryAgain")}</Button>}
        />
      ) : templates.data.length === 0 ? (
        <EmptyState icon={LayoutTemplate} message={t("templates.empty")} />
      ) : (
        <ul className="flex flex-col gap-2" aria-label={t("nav.templates")}>
          {templates.data.map((tpl) => (
            <TemplateRow key={tpl.id} template={tpl} />
          ))}
        </ul>
      )}
    </div>
  );
}
