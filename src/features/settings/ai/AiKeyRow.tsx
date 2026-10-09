import { useState, type FormEvent } from "react";
import { ExternalLink, KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAiActions } from "@/features/ai/api";
import { SettingRow } from "@/features/settings/SettingRow";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { aiApi } from "@/lib/api/ai";
import { toErrorPayload } from "@/lib/api/errors";
import { useToastStore } from "@/lib/toastStore";

/** Paste a Gemini key (checked with Google, then kept in the OS keychain), or remove it. */
export function AiKeyRow({ hasKey }: { hasKey: boolean }) {
  const { t } = useTranslation();
  const { setKey, clearKey } = useAiActions();
  const showToast = useToastStore((s) => s.show);
  const [key, setKeyText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setKey.mutate(key, {
      onSuccess: () => {
        setKeyText("");
        showToast({ message: t("ai.keySaved") });
      },
      onError: (err) => setError(toErrorPayload(err).message),
    });
  };

  if (hasKey) {
    return (
      <SettingRow label={t("ai.keyLabel")} description={t("ai.keyOnFile")}>
        <Button
          variant="secondary"
          disabled={clearKey.isPending}
          onClick={() =>
            clearKey.mutate(undefined, {
              onSuccess: () => showToast({ message: t("ai.keyRemoved") }),
            })
          }
        >
          {t("ai.removeKey")}
        </Button>
      </SettingRow>
    );
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <label htmlFor="ai-key" className="text-body font-semibold">
        {t("ai.keyLabel")}
      </label>
      <p className="text-small text-text-muted">{t("ai.keyHelp")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="ai-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={(e) => setKeyText(e.target.value)}
          className="h-10 min-w-64 flex-1 rounded-sm border border-border bg-surface-2 px-3 text-body text-text"
        />
        <Button type="submit" disabled={setKey.isPending || key.trim() === ""}>
          <KeyRound aria-hidden="true" />
          {t(setKey.isPending ? "ai.checking" : "ai.saveKey")}
        </Button>
        <Button variant="ghost" onClick={() => void aiApi.openKeyPage().catch(() => undefined)}>
          <ExternalLink aria-hidden="true" />
          {t("ai.getKey")}
        </Button>
      </div>
      {error && <FieldError message={t(error)} />}
    </form>
  );
}
