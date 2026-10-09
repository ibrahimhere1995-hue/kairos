import { Timer, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DiscardPrompt } from "@/features/items/editor/DiscardPrompt";
import { ScopePrompt } from "@/features/items/editor/ScopePrompt";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import type { EditScope } from "@/types/EditScope";

/**
 * Save / Cancel / Move to Trash, or in their place the "unsaved changes" guard or the
 * "only this one / this and following" choice for repeating items.
 */
export function EditorFooter({
  isNew,
  isEvent,
  busy,
  serverError,
  confirmDiscard,
  scopeFor,
  onKeepEditing,
  onDiscard,
  onCancel,
  onDelete,
  onChooseScope,
  onCancelScope,
  onFocus,
}: {
  isNew: boolean;
  isEvent: boolean;
  busy: boolean;
  serverError: string | undefined;
  confirmDiscard: boolean;
  /** Which action is waiting for the repeat scope, if any. */
  scopeFor: "save" | "delete" | null;
  onKeepEditing: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onChooseScope: (scope: EditScope) => void;
  onCancelScope: () => void;
  /** Existing tasks: close the editor and focus on this task (PRD R16). */
  onFocus?: () => void;
}) {
  const { t } = useTranslation();

  let body;
  if (scopeFor) {
    body = (
      <ScopePrompt
        question={t(scopeFor === "save" ? "scope.saveQuestion" : "scope.deleteQuestion")}
        onChoose={onChooseScope}
        onCancel={onCancelScope}
      />
    );
  } else if (confirmDiscard) {
    body = <DiscardPrompt onKeep={onKeepEditing} onDiscard={onDiscard} />;
  } else {
    body = (
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={busy}>
          {t(isNew ? (isEvent ? "editor.addEvent" : "editor.addTask") : "editor.save")}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        {onFocus && (
          <Button variant="ghost" onClick={onFocus}>
            <Timer aria-hidden="true" />
            {t("focus.focusOnThis")}
          </Button>
        )}
        {!isNew && (
          <Button
            variant="ghost"
            className="ml-auto text-text-muted"
            disabled={busy}
            onClick={onDelete}
          >
            <Trash2 aria-hidden="true" />
            {t("editor.moveToTrash")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <footer className="flex shrink-0 flex-col gap-3 border-t border-border px-5 py-4">
      {serverError && <FieldError message={t(serverError)} />}
      {body}
    </footer>
  );
}
