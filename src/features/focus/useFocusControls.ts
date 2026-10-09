import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { focusKey } from "@/features/focus/api";
import { useFocusStore, type FocusRun } from "@/features/focus/focusStore";
import { focusApi } from "@/lib/api/focus";
import { useToastStore } from "@/lib/toastStore";

const MINUTE = 60_000;

/**
 * Start, pause, resume and finish focus stretches. Each running work stretch is one logged
 * session; breaks and pauses are not focused time.
 */
export function useFocusControls() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const showToast = useToastStore((s) => s.show);
  const task = useFocusStore((s) => s.task);
  const plan = useFocusStore((s) => s.plan);
  const run = useFocusStore((s) => s.run);
  const setRun = useFocusStore((s) => s.setRun);
  const closeStore = useFocusStore((s) => s.close);

  const endSession = async (id: string | null) => {
    if (!id) return;
    try {
      await focusApi.stop(id);
    } finally {
      void queryClient.invalidateQueries({ queryKey: focusKey });
    }
  };

  /** Runs `leftMs` of work, logging it. The timer still runs if logging fails. */
  const work = async (leftMs: number, phaseMs: number) => {
    let sessionId: string | null = null;
    try {
      const minutes = Math.max(1, Math.ceil(leftMs / MINUTE));
      sessionId = (await focusApi.start(task?.id ?? null, minutes)).id;
    } catch {
      showToast({ message: t("focus.logFailed") });
    }
    setRun({ phase: "work", phaseMs, leftMs, endsAt: Date.now() + leftMs, sessionId });
  };

  const ready = (): FocusRun => {
    const phaseMs = plan.workMinutes * MINUTE;
    return { phase: "work", phaseMs, leftMs: phaseMs, endsAt: null, sessionId: null };
  };

  return {
    begin: () => work(plan.workMinutes * MINUTE, plan.workMinutes * MINUTE),
    pause: async () => {
      if (!run?.endsAt) return;
      setRun({
        ...run,
        leftMs: Math.max(0, run.endsAt - Date.now()),
        endsAt: null,
        sessionId: null,
      });
      await endSession(run.sessionId);
    },
    resume: async () => {
      if (!run || run.endsAt) return;
      if (run.phase === "work") await work(run.leftMs, run.phaseMs);
      else setRun({ ...run, endsAt: Date.now() + run.leftMs });
    },
    /** The phase ran out: work → break (if any) → ready for the next stretch. */
    finishPhase: async () => {
      if (!run) return;
      const breakMs = plan.breakMinutes * MINUTE;
      if (run.phase === "work" && breakMs > 0) {
        setRun({
          phase: "break",
          phaseMs: breakMs,
          leftMs: breakMs,
          endsAt: Date.now() + breakMs,
          sessionId: null,
        });
      } else {
        setRun(ready());
      }
      await endSession(run.sessionId);
    },
    skipBreak: () => setRun(ready()),
    stop: async () => {
      const sessionId = run?.sessionId ?? null;
      closeStore();
      await endSession(sessionId);
    },
  };
}
