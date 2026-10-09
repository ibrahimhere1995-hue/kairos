import { useRef, useState, type KeyboardEvent } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Mic } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toErrorPayload } from "@/lib/api/errors";
import { VOICE_PARTIAL, voiceApi } from "@/lib/api/voice";
import { isWindows } from "@/lib/platform";
import { cn } from "@/lib/utils";

/** Reasons the user can fix in Windows settings. */
const FIXABLE = new Set(["privacy", "microphone"]);

/**
 * PRD R20: hold to speak (mouse, touch, or Space/Enter held down), release to get the words.
 * Uses Windows speech recognition; only the text is kept. Hidden on other systems for now.
 */
export function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const { t } = useTranslation();
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** Resolves to the start error, if any (kept, not thrown, until release). */
  const started = useRef<Promise<unknown> | null>(null);
  const unlisten = useRef<UnlistenFn | null>(null);

  if (!isWindows()) return null;

  const begin = () => {
    if (started.current) return;
    setError(null);
    setPartial("");
    setListening(true);
    void listen<string>(VOICE_PARTIAL, (e) => setPartial(e.payload)).then((off) => {
      // Released before listening began: stop listening straight away.
      if (started.current) unlisten.current = off;
      else off();
    });
    started.current = voiceApi.start().then(
      () => null,
      (e: unknown) => e ?? new Error("voice"),
    );
  };

  const end = async () => {
    const start = started.current;
    if (!start) return;
    started.current = null;
    setListening(false);
    try {
      const failed = await start;
      if (failed) throw failed;
      const text = (await voiceApi.stop()).trim();
      if (text) onText(text);
    } catch (e) {
      setError(toErrorPayload(e).message);
    } finally {
      unlisten.current?.();
      unlisten.current = null;
      setPartial("");
    }
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, down: boolean) => {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    if (down && !e.repeat) begin();
    if (!down) void end();
  };
  const reason = error?.split(".").pop() ?? "";

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        aria-pressed={listening}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          begin();
        }}
        onPointerUp={() => void end()}
        onPointerCancel={() => void end()}
        onKeyDown={(e) => onKey(e, true)}
        onKeyUp={(e) => onKey(e, false)}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm px-2 py-1 font-semibold text-accent-text hover:bg-surface-3",
          listening && "bg-surface-3",
        )}
      >
        <Mic aria-hidden="true" className={cn("size-4", listening && "now-pulse")} />
        {t(listening ? "voice.listening" : "voice.hold")}
      </button>
      <span aria-live="polite" className="text-small text-text-muted">
        {partial}
      </span>
      {error && (
        <span role="alert" className="text-small text-text">
          {t(error)}{" "}
          {FIXABLE.has(reason) && (
            <button
              type="button"
              className="font-semibold text-accent-text underline"
              onClick={() => void voiceApi.openSettings(reason).catch(() => undefined)}
            >
              {t("voice.openSettings")}
            </button>
          )}
        </span>
      )}
    </span>
  );
}
