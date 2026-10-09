import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { KIND_ICONS } from "@/features/feedback/kindIcons";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { toErrorPayload } from "@/lib/api/errors";
import type { FeedbackKind } from "@/lib/api/feedback";

/** Kind + text, for a new wishlist entry or an edit. `extra` sits above the buttons. */
export function FeedbackForm({
  initial,
  submitLabel,
  extra,
  onSubmit,
  onCancel,
}: {
  initial?: { kind: FeedbackKind; text: string };
  submitLabel: string;
  extra?: ReactNode;
  onSubmit: (kind: FeedbackKind, text: string) => Promise<unknown>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<FeedbackKind>(initial?.kind ?? "idea");
  const [text, setText] = useState(initial?.text ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit(kind, text);
    } catch (err) {
      setError(toErrorPayload(err).message);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <SegmentedControl<FeedbackKind>
        name="feedback-kind"
        legend={t("feedback.kind")}
        value={kind}
        onChange={setKind}
        options={(["idea", "frustration", "bug"] as const).map((k) => ({
          value: k,
          label: t(`feedback.kinds.${k}`),
          icon: KIND_ICONS[k],
        }))}
      />
      <label className="flex flex-col gap-1">
        <span className="text-body font-semibold">{t("feedback.text")}</span>
        <textarea
          value={text}
          rows={4}
          maxLength={2000}
          placeholder={t("feedback.textPlaceholder")}
          onChange={(e) => setText(e.target.value)}
          className="rounded-sm border border-border bg-surface-2 px-3 py-2 text-body text-text"
        />
        {error && <FieldError message={t(error)} />}
      </label>
      {extra}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
