import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import type { EditScope } from "@/types/EditScope";

/** For repeating items: change (or trash) only this occurrence, or this and the following ones. */
export function ScopePrompt({
  question,
  onChoose,
  onCancel,
}: {
  question: string;
  onChoose: (scope: EditScope) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => firstRef.current?.focus(), []);

  return (
    <div
      role="alertdialog"
      aria-labelledby="scope-question"
      className="flex flex-col gap-3 rounded-md border border-border-strong bg-surface-2 p-3"
    >
      <p id="scope-question" className="text-body">
        {question}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button ref={firstRef} variant="secondary" size="sm" onClick={() => onChoose("this")}>
          {t("scope.this")}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onChoose("following")}>
          {t("scope.following")}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}
