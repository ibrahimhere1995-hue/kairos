import { useMemo } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import * as chrono from "chrono-node";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "@/app/theme/themeStore";
import { useCaptureStore } from "@/features/capture/captureStore";
import { useFeedbackStore } from "@/features/feedback/feedbackStore";
import { screenName } from "@/features/feedback/screenName";
import { useFocusStore } from "@/features/focus/focusStore";
import { matchCommands, type PaletteCommand } from "@/features/search/paletteEntries";
import { toLocalDateString } from "@/lib/dates/dayContext";

/**
 * PRD R9: the palette doubles as a command list ("new task", "go to week", "switch theme").
 * Typing a date ("12 Oct", "next friday") also offers to show that day in the calendar.
 */
export function usePaletteCommands(query: string): PaletteCommand[] {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openCapture = useCaptureStore((s) => s.openCapture);
  const setPreference = useThemeStore((s) => s.setPreference);
  const openFocus = useFocusStore((s) => s.openFocus);
  const openSuggest = useFeedbackStore((s) => s.openSuggest);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const all = useMemo<PaletteCommand[]>(() => {
    const nav = t("palette.keywords.nav");
    const theme = t("palette.keywords.theme");
    const go = (to: string, search?: Record<string, string>) => () =>
      void navigate({ to, search: search ?? {} });
    return [
      {
        id: "new-task",
        label: t("palette.cmd.newTask"),
        keywords: t("palette.keywords.newTask"),
        run: openCapture,
      },
      {
        id: "go-my-day",
        label: t("palette.cmd.goMyDay"),
        keywords: `${nav} home today`,
        run: go("/"),
      },
      {
        id: "go-day",
        label: t("palette.cmd.goDay"),
        keywords: nav,
        run: go("/calendar", { view: "day" }),
      },
      {
        id: "go-week",
        label: t("palette.cmd.goWeek"),
        keywords: nav,
        run: go("/calendar", { view: "week" }),
      },
      {
        id: "go-month",
        label: t("palette.cmd.goMonth"),
        keywords: nav,
        run: go("/calendar", { view: "month" }),
      },
      {
        id: "go-agenda",
        label: t("palette.cmd.goAgenda"),
        keywords: `${nav} list`,
        run: go("/calendar", { view: "agenda" }),
      },
      { id: "go-inbox", label: t("palette.cmd.goInbox"), keywords: nav, run: go("/inbox") },
      {
        id: "go-habits",
        label: t("palette.cmd.goHabits"),
        keywords: `${nav} streak routine`,
        run: go("/habits"),
      },
      {
        id: "start-focus",
        label: t("palette.cmd.startFocus"),
        keywords: "pomodoro timer deep work concentrate",
        run: () => openFocus(),
      },
      {
        id: "suggest",
        label: t("palette.cmd.suggest"),
        keywords: "feedback idea wish bug frustration",
        run: () => openSuggest(screenName(pathname, t)),
      },
      {
        id: "go-wishlist",
        label: t("palette.cmd.goWishlist"),
        keywords: `${nav} feedback ideas`,
        run: go("/wishlist"),
      },
      {
        id: "go-review",
        label: t("palette.cmd.goReview"),
        keywords: `${nav} weekly week reflect`,
        run: go("/review"),
      },
      { id: "go-goals", label: t("palette.cmd.goGoals"), keywords: nav, run: go("/goals") },
      {
        id: "go-templates",
        label: t("palette.cmd.goTemplates"),
        keywords: `${nav} routine plan`,
        run: go("/templates"),
      },
      {
        id: "go-trash",
        label: t("palette.cmd.goTrash"),
        keywords: `${nav} deleted restore`,
        run: go("/trash"),
      },
      {
        id: "go-settings",
        label: t("palette.cmd.goSettings"),
        keywords: `${nav} preferences options`,
        run: go("/settings"),
      },
      {
        id: "theme-light",
        label: t("palette.cmd.themeLight"),
        keywords: theme,
        run: () => setPreference("light"),
      },
      {
        id: "theme-dark",
        label: t("palette.cmd.themeDark"),
        keywords: theme,
        run: () => setPreference("dark"),
      },
      {
        id: "theme-system",
        label: t("palette.cmd.themeSystem"),
        keywords: theme,
        run: () => setPreference("system"),
      },
    ];
  }, [t, navigate, openCapture, setPreference, openFocus, openSuggest, pathname]);

  return useMemo(() => {
    const matched = matchCommands(all, query);
    const date = query.trim() ? chrono.parseDate(query, new Date(), { forwardDate: true }) : null;
    if (!date) return matched;
    const day = toLocalDateString(date);
    return [
      {
        id: `go-date-${day}`,
        label: t("palette.cmd.goDate", { date: format(date, "EEE d MMM yyyy") }),
        keywords: "",
        run: () => void navigate({ to: "/calendar", search: { view: "day", date: day } }),
      },
      ...matched,
    ];
  }, [all, query, t, navigate]);
}
