import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, List, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CalendarView } from "@/features/calendar/calendarView";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

export function CalendarToolbar({
  title,
  view,
  onViewChange,
  onStep,
  onToday,
}: {
  title: string;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onStep: (direction: 1 | -1) => void;
  onToday: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="mr-auto font-display text-h1">{title}</h1>
      <div className="flex items-center gap-1">
        <IconButton
          icon={ChevronLeft}
          label={t(`calendar.previous.${view}`)}
          onClick={() => onStep(-1)}
        />
        <Button variant="secondary" onClick={onToday} aria-keyshortcuts="T">
          {t("calendar.today")}
          <kbd className="rounded-sm border border-border bg-surface px-1.5 font-sans text-caption text-text-muted">
            T
          </kbd>
        </Button>
        <IconButton
          icon={ChevronRight}
          label={t(`calendar.next.${view}`)}
          onClick={() => onStep(1)}
        />
      </div>
      <SegmentedControl
        name="calendar-view"
        legend={t("calendar.viewLabel")}
        value={view}
        onChange={onViewChange}
        options={[
          { value: "day", label: t("calendar.views.day"), icon: Square },
          { value: "week", label: t("calendar.views.week"), icon: CalendarRange },
          { value: "month", label: t("calendar.views.month"), icon: CalendarDays },
          { value: "agenda", label: t("calendar.views.agenda"), icon: List },
        ]}
      />
    </div>
  );
}
