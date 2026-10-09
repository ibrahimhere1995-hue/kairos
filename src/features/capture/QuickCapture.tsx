import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { captureToItemInput } from "@/features/capture/captureInput";
import { CaptureChip } from "@/features/capture/CaptureChip";
import { chipLabel } from "@/features/capture/chipLabel";
import { useActiveAreas, useCreateItem } from "@/features/items/api";
import { FieldError } from "@/components/ui/FieldError";
import { toErrorPayload } from "@/lib/api/errors";
import { getDayContext } from "@/lib/dates/dayContext";
import { parseCapture, type ChipKind, type ParsedCapture } from "@/lib/nlp/parseCapture";

/**
 * The capture bar (PRD R4), shared by the in-app dialog and the global Quick Capture window.
 * Type → recognised parts appear as chips → Enter saves, Esc cancels.
 */
export function QuickCapture({
  onSaved,
  onCancel,
  onMoreDetails,
}: {
  onSaved: () => void;
  onCancel: () => void;
  /** Opens the full editor with what was typed so far (in-app only). */
  onMoreDetails?: (parsed: ParsedCapture) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [ignored, setIgnored] = useState<ReadonlySet<ChipKind>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const ownInput = useRef<HTMLInputElement>(null);
  const { data: areas = [] } = useActiveAreas();
  const create = useCreateItem();

  const today = getDayContext().today;
  const parsed = useMemo(
    () => parseCapture(text, { now: new Date(), areas, ignore: ignored }),
    [text, areas, ignored],
  );
  const canSave = text.trim() !== "" && !create.isPending;

  const save = () => {
    if (!canSave) return;
    setError(null);
    create.mutate(captureToItemInput(parsed, today), {
      onSuccess: () => {
        setText("");
        setIgnored(new Set());
        onSaved();
      },
      onError: (e) => setError(toErrorPayload(e).message),
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={ownInput}
        data-autofocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        aria-label={t("capture.label")}
        aria-describedby="capture-hint"
        placeholder={t("capture.placeholder")}
        className="h-12 w-full rounded-md border border-border bg-surface-2 px-4 text-h3 placeholder:font-normal placeholder:text-text-subtle focus:border-border-strong"
      />
      {parsed.chips.length > 0 && (
        <ul aria-label={t("capture.recognised")} className="flex flex-wrap gap-2">
          {parsed.chips.map((kind, index) => (
            <CaptureChip
              key={kind}
              kind={kind}
              index={index}
              label={chipLabel(kind, parsed, today, areas, t)}
              onRemove={() => {
                setIgnored((prev) => new Set(prev).add(kind));
                // The chip (and its button) disappears; keep typing where you were.
                ownInput.current?.focus();
              }}
            />
          ))}
        </ul>
      )}
      {error && <FieldError message={t(error)} />}
      <div className="flex items-center gap-3 text-small text-text-muted">
        <p id="capture-hint" className="flex-1">
          {t("capture.hint", { title: parsed.title || "…" })}
        </p>
        {onMoreDetails && (
          <button
            type="button"
            onClick={() => onMoreDetails(parsed)}
            className="inline-flex items-center gap-1 rounded-sm px-2 py-1 font-semibold text-accent-text hover:bg-surface-3"
          >
            <Sparkles aria-hidden="true" className="size-4" />
            {t("capture.moreDetails")}
          </button>
        )}
      </div>
    </div>
  );
}
