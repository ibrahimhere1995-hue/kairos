import { useId } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ResolvedTheme } from "@/app/theme/theme";
import { Button } from "@/components/ui/Button";
import { ColorSwatch } from "@/features/dev/ColorSwatch";
import { LabelledSample } from "@/features/dev/LabelledSample";
import {
  AREA_SAMPLES,
  STATUS_SAMPLES,
  SWATCH_GROUPS,
  TYPE_SAMPLES,
} from "@/features/dev/tokenGroups";

/** Renders every token sample inside a subtree forced to one theme via `data-theme`. */
export function StyleguidePanel({ theme }: { theme: ResolvedTheme }) {
  const { t } = useTranslation();
  const headingId = useId();

  return (
    <section
      data-theme={theme}
      aria-labelledby={headingId}
      className="flex flex-col gap-8 rounded-lg border border-border bg-bg p-6 text-text shadow-md"
    >
      <h2 id={headingId} className="text-h2">
        {t(theme === "light" ? "styleguide.lightPanel" : "styleguide.darkPanel")}
      </h2>

      {SWATCH_GROUPS.map((group) => (
        <div key={group.titleKey} className="flex flex-col gap-3">
          <h3 className="text-h3">{t(group.titleKey)}</h3>
          <ul className="grid grid-cols-2 gap-3">
            {group.tokens.map((token) => (
              <ColorSwatch key={token} token={token} />
            ))}
          </ul>
        </div>
      ))}

      {[
        { titleKey: "styleguide.statusTitle", samples: STATUS_SAMPLES },
        { titleKey: "styleguide.areasTitle", samples: AREA_SAMPLES },
      ].map(({ titleKey, samples }) => (
        <div key={titleKey} className="flex flex-col gap-3">
          <h3 className="text-h3">{t(titleKey)}</h3>
          <ul className="flex flex-wrap gap-2">
            {samples.map((s) => (
              <LabelledSample key={s.token} token={s.token} icon={s.icon} label={t(s.labelKey)} />
            ))}
          </ul>
        </div>
      ))}

      <div className="flex flex-col gap-3">
        <h3 className="text-h3">{t("styleguide.typeTitle")}</h3>
        <dl className="flex flex-col gap-3 rounded-md bg-surface p-4">
          {TYPE_SAMPLES.map(({ role, className }) => (
            <div key={role} className="flex flex-col gap-1">
              <dt className="text-caption text-text-subtle">{t(`styleguide.roles.${role}`)}</dt>
              <dd className={className}>{t(`styleguide.samples.${role}`)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-h3">{t("styleguide.buttonsTitle")}</h3>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg">
            <Plus aria-hidden="true" />
            {t("styleguide.buttons.primary")}
          </Button>
          <Button variant="secondary">{t("styleguide.buttons.secondary")}</Button>
          <Button variant="ghost">{t("styleguide.buttons.ghost")}</Button>
          <Button variant="destructive">{t("styleguide.buttons.destructive")}</Button>
          <Button disabled>{t("styleguide.buttons.disabled")}</Button>
        </div>
      </div>
    </section>
  );
}
