import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAiReady } from "@/features/ai/api";
import { PlanForm } from "@/features/ai/plan/PlanForm";
import { usePlanStore } from "@/features/ai/plan/planStore";
import { Button } from "@/components/ui/Button";

/** PRD A3: "Plan my day / week". Suggestions only; nothing moves until the user accepts. */
export function PlanDialog() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const open = usePlanStore((s) => s.open);
  const span = usePlanStore((s) => s.span);
  const close = usePlanStore((s) => s.close);
  const ready = useAiReady();

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-text/20" />
        <Dialog.Content className="capture-in fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100vh-4rem)] w-[34rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-surface p-6 text-text shadow-lg">
          <Dialog.Title className="text-h2">{t("plan.title")}</Dialog.Title>
          <Dialog.Description className="text-body text-text-muted">
            {t("plan.intro")}
          </Dialog.Description>
          {open &&
            (ready ? (
              <PlanForm initialSpan={span} onDone={close} />
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-body">{t("errors.ai.off")}</p>
                <Button
                  variant="secondary"
                  className="self-start"
                  onClick={() => {
                    close();
                    void navigate({ to: "/settings" });
                  }}
                >
                  {t("palette.cmd.goSettings")}
                </Button>
              </div>
            ))}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
