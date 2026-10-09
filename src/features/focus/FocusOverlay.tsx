import { useEffect, useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { useFocusTotals } from "@/features/focus/api";
import { FocusSetup } from "@/features/focus/FocusSetup";
import { useFocusStore } from "@/features/focus/focusStore";
import { FocusTimer } from "@/features/focus/FocusTimer";
import { useFocusControls } from "@/features/focus/useFocusControls";
import { friendlyDuration } from "@/features/items/editor/friendlyDate";
import { useCompleteItem } from "@/features/items/api";
import { focusApi } from "@/lib/api/focus";
import { getDayContext } from "@/lib/dates/dayContext";

/**
 * PRD R16: one task, a calm full-screen view and a timer. While it is open the window goes
 * full screen and Kairos holds its notifications until you finish. Esc ends focus.
 */
export function FocusOverlay() {
  const { t } = useTranslation();
  const open = useFocusStore((s) => s.open);
  const task = useFocusStore((s) => s.task);
  const run = useFocusStore((s) => s.run);
  const controls = useFocusControls();
  const complete = useCompleteItem();
  const day = useMemo(() => (open ? getDayContext() : null), [open]);
  const totals = useFocusTotals(
    day?.dayStart.toISOString() ?? "",
    day?.dayEnd.toISOString() ?? "",
    open,
  );
  const focusedMinutes = Math.round(
    (totals.data ?? []).reduce((sum, total) => sum + total.seconds, 0) / 60,
  );

  // Also runs on start-up with `false`, so a reload never leaves notifications held.
  useEffect(() => {
    void focusApi.setMode(open).catch(() => undefined);
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && void controls.stop()}>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 overflow-y-auto bg-bg p-8 text-text outline-none"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
            className="flex w-full flex-col items-center gap-8"
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <Dialog.Title className="text-small tracking-wide text-text-muted uppercase">
                {t("focus.title")}
              </Dialog.Title>
              <p className="max-w-2xl font-display text-h1">{task?.title ?? t("focus.noTask")}</p>
            </div>
            {run ? (
              <FocusTimer
                key={`${run.phase}-${run.endsAt ?? "paused"}`}
                run={run}
                canComplete={task !== null && task.completedAt === null && run.phase === "work"}
                onPause={() => void controls.pause()}
                onResume={() => void controls.resume()}
                onFinishPhase={() => void controls.finishPhase()}
                onSkipBreak={controls.skipBreak}
                onComplete={() => {
                  if (task) complete.mutate(task);
                  void controls.stop();
                }}
                onStop={() => void controls.stop()}
              />
            ) : (
              <FocusSetup onStart={() => void controls.begin()} />
            )}
            {focusedMinutes > 0 && (
              <p className="text-small text-text-muted">
                {t("focus.today", { time: friendlyDuration(focusedMinutes, t) })}
              </p>
            )}
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
