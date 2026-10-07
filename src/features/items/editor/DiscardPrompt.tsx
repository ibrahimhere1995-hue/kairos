import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";

/** Inline "unsaved changes" guard shown instead of closing the editor. */
export function DiscardPrompt({
  onKeep,
  onDiscard,
}: {
  onKeep: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => keepRef.current?.focus(), []);

  return (
    <div
      role="alertdialog"
      aria-labelledby="discard-title"
      className="flex flex-wrap items-center gap-3 rounded-md border border-border-strong bg-surface-2 p-3"
    >
      <p id="discard-title" className="flex-1 text-body">
        {t("editor.discardQuestion")}
      </p>
      <Button ref={keepRef} variant="secondary" size="sm" onClick={onKeep}>
        {t("editor.keepEditing")}
      </Button>
      <Button variant="ghost" size="sm" onClick={onDiscard}>
        {t("editor.discard")}
      </Button>
    </div>
  );
}
