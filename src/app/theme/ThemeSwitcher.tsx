import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ThemePreference } from "@/app/theme/theme";
import { useThemeStore } from "@/app/theme/themeStore";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePreference; icon: LucideIcon; labelKey: string }[] = [
  { value: "light", icon: Sun, labelKey: "theme.light" },
  { value: "dark", icon: Moon, labelKey: "theme.dark" },
  { value: "system", icon: Monitor, labelKey: "theme.system" },
];

/** Segmented Light / Dark / Match system control, built on native radios for keyboard + screen readers. */
export function ThemeSwitcher() {
  const { t } = useTranslation();
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);

  return (
    <fieldset>
      <legend className="sr-only">{t("theme.label")}</legend>
      <div className="inline-flex gap-1 rounded-md border border-border bg-surface-2 p-1">
        {OPTIONS.map(({ value, icon: Icon, labelKey }) => (
          <label
            key={value}
            className={cn(
              "inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm px-3 text-small text-text-muted",
              "hover:bg-surface-3 hover:text-text",
              "has-[:checked]:bg-surface has-[:checked]:text-text has-[:checked]:shadow-sm",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus-ring",
            )}
          >
            <input
              type="radio"
              name="theme-preference"
              value={value}
              checked={preference === value}
              onChange={() => setPreference(value)}
              className="sr-only"
            />
            <Icon aria-hidden="true" className="size-4" />
            <span>{t(labelKey)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
