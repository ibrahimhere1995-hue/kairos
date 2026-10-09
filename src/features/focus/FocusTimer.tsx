import { useEffect, useState } from "react";
import { Check, Pause, Play, SkipForward, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FocusRun } from "@/features/focus/focusStore";
import { FocusRing } from "@/features/focus/FocusRing";
import { formatClock } from "@/features/focus/timer";
import { Button } from "@/components/ui/Button";

/**
 * The running timer. Remount it (by `key`) whenever `run.endsAt` changes so the clock
 * starts from the current moment.
 */
export function FocusTimer({
  run,
  canComplete,
  onPause,
  onResume,
  onFinishPhase,
  onSkipBreak,
  onComplete,
  onStop,
}: {
  run: FocusRun;
  canComplete: boolean;
  onPause: () => void;
  onResume: () => void;
  onFinishPhase: () => void;
  onSkipBreak: () => void;
  onComplete: () => void;
  onStop: () => void;
}) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  const running = run.endsAt !== null;
  const leftMs = running ? Math.max(0, (run.endsAt ?? 0) - now) : run.leftMs;
  const rest = run.phase === "break";
  const waiting = !running && !rest && run.leftMs === run.phaseMs;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (running && leftMs === 0) onFinishPhase();
  }, [running, leftMs, onFinishPhase]);

  const status = rest
    ? t("focus.onBreak")
    : waiting
      ? t("focus.readyNext")
      : running
        ? t("focus.focusing")
        : t("focus.paused");

  return (
    <div className="flex flex-col items-center gap-6">
      <p aria-live="polite" className="text-h3 text-text-muted">
        {status}
      </p>
      <div className="relative grid size-64 place-items-center">
        <FocusRing leftMs={leftMs} phaseMs={run.phaseMs} rest={rest} />
        <span
          role="timer"
          aria-label={t("focus.timeLeft", { time: formatClock(leftMs) })}
          className="font-display text-display tabular-nums"
        >
          {formatClock(leftMs)}
        </span>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {running ? (
          <Button variant="secondary" onClick={onPause}>
            <Pause aria-hidden="true" />
            {t("focus.pause")}
          </Button>
        ) : (
          <Button onClick={onResume}>
            <Play aria-hidden="true" />
            {t(waiting ? "focus.startNext" : "focus.resume")}
          </Button>
        )}
        {rest && (
          <Button variant="ghost" onClick={onSkipBreak}>
            <SkipForward aria-hidden="true" />
            {t("focus.skipBreak")}
          </Button>
        )}
        {canComplete && (
          <Button variant="ghost" onClick={onComplete}>
            <Check aria-hidden="true" />
            {t("focus.markDone")}
          </Button>
        )}
        <Button variant="ghost" onClick={onStop}>
          <Square aria-hidden="true" />
          {t("focus.end")}
        </Button>
      </div>
    </div>
  );
}
