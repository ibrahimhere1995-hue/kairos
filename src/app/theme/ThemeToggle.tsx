import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "@/app/theme/themeStore";
import { useResolvedTheme } from "@/app/theme/useResolvedTheme";
import { IconButton } from "@/components/ui/IconButton";

/** Top-bar quick toggle between light and dark. "Match system" lives in Settings. */
export function ThemeToggle() {
  const { t } = useTranslation();
  const resolved = useResolvedTheme();
  const setPreference = useThemeStore((state) => state.setPreference);
  const next = resolved === "dark" ? "light" : "dark";

  return (
    <IconButton
      icon={next === "dark" ? Moon : Sun}
      label={t(next === "dark" ? "theme.switchToDark" : "theme.switchToLight")}
      onClick={() => setPreference(next)}
    />
  );
}
