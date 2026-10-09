import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFeedbackActions } from "@/features/feedback/api";
import { FeedbackForm } from "@/features/feedback/FeedbackForm";
import { KIND_ICONS } from "@/features/feedback/kindIcons";
import { IconButton } from "@/components/ui/IconButton";
import type { FeedbackKind, FeedbackStatus } from "@/lib/api/feedback";
import type { Feedback } from "@/types/Feedback";

const STATUSES: FeedbackStatus[] = ["open", "planned", "done"];

/** One wishlist entry: kind, text, when (and where) it was written; move, edit or delete it. */
export function FeedbackCard({ entry }: { entry: Feedback }) {
  const { t } = useTranslation();
  const { update, move, remove } = useFeedbackActions();
  const [editing, setEditing] = useState(false);
  const kind = entry.kind as FeedbackKind;
  const Icon = KIND_ICONS[kind] ?? KIND_ICONS.idea;
  const short = entry.text.length > 40 ? `${entry.text.slice(0, 40)}…` : entry.text;

  if (editing) {
    return (
      <li className="rounded-md border border-border bg-surface p-3">
        <FeedbackForm
          initial={{ kind, text: entry.text }}
          submitLabel={t("editor.save")}
          onCancel={() => setEditing(false)}
          onSubmit={(k, text) =>
            update
              .mutateAsync({ id: entry.id, input: { kind: k, text, context: entry.context } })
              .then(() => setEditing(false))
          }
        />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
      <span className="inline-flex items-center gap-1.5 text-small text-text-muted">
        <Icon aria-hidden="true" className="size-4 text-accent-text" />
        {t(`feedback.kinds.${kind}`)} · {format(parseISO(entry.createdAt), "d MMM yyyy")}
        {entry.context && ` · ${t("feedback.on", { screen: entry.context })}`}
      </span>
      <p className="text-body break-words whitespace-pre-wrap">{entry.text}</p>
      <div className="flex items-center gap-1">
        <select
          value={entry.status}
          aria-label={t("feedback.moveTo", { text: short })}
          onChange={(e) => move.mutate({ id: entry.id, status: e.target.value as FeedbackStatus })}
          className="h-9 rounded-sm border border-border bg-surface-2 px-2 text-small text-text"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`feedback.statuses.${s}`)}
            </option>
          ))}
        </select>
        <IconButton
          icon={Pencil}
          label={t("feedback.edit", { text: short })}
          className="ml-auto"
          onClick={() => setEditing(true)}
        />
        <IconButton
          icon={Trash2}
          label={t("feedback.delete", { text: short })}
          onClick={() => remove.mutate(entry.id)}
        />
      </div>
    </li>
  );
}
