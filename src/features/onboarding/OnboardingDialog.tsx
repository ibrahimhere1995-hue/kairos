import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "@/app/theme/themeStore";
import { useActiveAreas } from "@/features/items/api";
import { AreasStep } from "@/features/onboarding/AreasStep";
import { useFinishOnboarding, useOnboarding, useSkipOnboarding } from "@/features/onboarding/api";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { ThemePreference } from "@/types/ThemePreference";

const STEPS = 3;

/**
 * First launch (PRD R7): Welcome (name) → Theme → Life areas. Every step can be skipped;
 * the theme changes live. Shown once; finishing or skipping adds the sample tasks.
 */
export function OnboardingDialog() {
  const { t } = useTranslation();
  const { data } = useOnboarding();
  const { data: areas = [] } = useActiveAreas();
  const { preference, setPreference } = useThemeStore();
  const finish = useFinishOnboarding();
  const skip = useSkipOnboarding();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  // Areas the user unticked; everything else is kept.
  const [unticked, setUnticked] = useState<Set<string>>(new Set());

  if (!data?.needed) return null;
  const busy = finish.isPending || skip.isPending;
  const kept = new Set(areas.map((a) => a.id).filter((id) => !unticked.has(id)));

  const done = () => finish.mutate({ name, theme: preference, keepAreaIds: [...kept] });

  return (
    <Dialog.Root open onOpenChange={(open) => !open && skip.mutate()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-6 text-text"
        >
          <div className="flex w-[32rem] max-w-full flex-col gap-6 rounded-lg border border-border bg-surface p-8 shadow-lg">
            <Dialog.Title className="sr-only">{t("onboarding.title")}</Dialog.Title>
            <p className="text-small text-text-muted">
              {t("onboarding.step", { current: step, total: STEPS })}
            </p>

            {step === 1 && (
              <div className="flex flex-col gap-4">
                <h2 className="font-display text-display">{t("onboarding.welcomeTitle")}</h2>
                <p className="text-h3 text-accent-text">{t("onboarding.tagline")}</p>
                <p className="text-body text-text-muted">{t("onboarding.welcomeBody")}</p>
                <label className="flex flex-col gap-1 text-body">
                  {t("onboarding.nameLabel")}
                  <input
                    data-autofocus
                    type="text"
                    value={name}
                    maxLength={40}
                    placeholder={t("onboarding.namePlaceholder")}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10 rounded-sm border border-border bg-surface-2 px-3 text-body text-text"
                  />
                </label>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col gap-4">
                <h2 className="font-display text-h1">{t("onboarding.themeTitle")}</h2>
                <p className="text-body text-text-muted">{t("onboarding.themeBody")}</p>
                <SegmentedControl<ThemePreference>
                  name="onboarding-theme"
                  legend={t("theme.label")}
                  value={preference}
                  onChange={setPreference}
                  options={[
                    { value: "light", label: t("theme.light"), icon: Sun },
                    { value: "dark", label: t("theme.dark"), icon: Moon },
                    { value: "system", label: t("theme.system"), icon: Monitor },
                  ]}
                />
              </div>
            )}

            {step === 3 && (
              <AreasStep
                areas={areas}
                kept={kept}
                onToggle={(id) =>
                  setUnticked((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
              />
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" disabled={busy} onClick={() => skip.mutate()}>
                {t("onboarding.skip")}
              </Button>
              <div className="ml-auto flex gap-2">
                {step > 1 && (
                  <Button variant="secondary" onClick={() => setStep(step - 1)}>
                    {t("onboarding.back")}
                  </Button>
                )}
                {step < STEPS ? (
                  <Button onClick={() => setStep(step + 1)}>{t("onboarding.next")}</Button>
                ) : (
                  <Button disabled={busy} onClick={done}>
                    {t("onboarding.start")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
