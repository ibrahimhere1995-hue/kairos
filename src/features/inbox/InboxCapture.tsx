import { useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { ImagePlus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useInboxActions } from "@/features/inbox/api";
import { VoiceButton } from "@/features/voice/VoiceButton";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { toErrorPayload } from "@/lib/api/errors";

/** Jot a note (Enter adds, Shift+Enter for a new line) or paste / pick a screenshot. */
export function InboxCapture() {
  const { t } = useTranslation();
  const { addText, addImage, pickImage } = useInboxActions();
  const [text, setText] = useState("");
  const error = addText.error ?? addImage.error ?? pickImage.error;

  const add = () => {
    if (text.trim() === "") return;
    addText.mutate(text, { onSuccess: () => setText("") });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      add();
    }
  };
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
    if (!file) return;
    e.preventDefault();
    const type = file.type.replace("image/", "");
    void file
      .arrayBuffer()
      .then((buffer) => addImage.mutate({ bytes: new Uint8Array(buffer), type }));
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <textarea
        rows={2}
        value={text}
        aria-label={t("inbox.noteLabel")}
        placeholder={t("inbox.notePlaceholder")}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        className="resize-y rounded-sm border border-transparent bg-transparent p-2 text-body text-text placeholder:text-text-subtle focus:border-border"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={text.trim() === "" || addText.isPending} onClick={add}>
          <Plus aria-hidden="true" />
          {t("inbox.addNote")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pickImage.isPending}
          onClick={() => pickImage.mutate(t("inbox.pickPicture"))}
        >
          <ImagePlus aria-hidden="true" />
          {t("inbox.addPicture")}
        </Button>
        <VoiceButton
          onText={(spoken) =>
            setText((prev) => (prev.trim() ? `${prev.trim()} ${spoken}` : spoken))
          }
        />
        <span className="text-small text-text-muted">{t("inbox.pasteHint")}</span>
      </div>
      {error && <FieldError message={t(toErrorPayload(error).message)} />}
    </div>
  );
}
