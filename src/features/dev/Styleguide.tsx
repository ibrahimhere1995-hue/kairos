import { useTranslation } from "react-i18next";
import { ThemeSwitcher } from "@/app/theme/ThemeSwitcher";
import { StyleguidePanel } from "@/features/dev/StyleguidePanel";

/** Developer-only token showcase at `/dev/styleguide` (P1-T02). Not reachable in release builds. */
export function Styleguide() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-display">{t("styleguide.title")}</h1>
          <p className="text-text-muted">{t("styleguide.intro")}</p>
        </div>
        <ThemeSwitcher />
      </header>
      <div className="grid gap-8 min-[1200px]:grid-cols-2">
        <StyleguidePanel theme="light" />
        <StyleguidePanel theme="dark" />
      </div>
    </div>
  );
}
