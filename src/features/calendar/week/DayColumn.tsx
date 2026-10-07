import { useRef, useState, type PointerEvent } from "react";
import { addMinutes, format } from "date-fns";
import { useDroppable } from "@dnd-kit/core";
import {
  MINUTES_PER_DAY,
  SNAP_MINUTES,
  snapMinutes,
  type PositionedItem,
} from "@/features/calendar/layout";
import { columnId } from "@/features/calendar/week/dragData";
import { EventBlock } from "@/features/calendar/week/EventBlock";
import { minutesToRem, pxPerMinute } from "@/features/calendar/week/gridMetrics";
import { NowLine } from "@/features/calendar/week/NowLine";
import { useEditorStore } from "@/features/items/editorStore";
import type { DayContext } from "@/lib/dates/dayContext";
import { getItemStatus } from "@/lib/status/status";
import { cn } from "@/lib/utils";
import type { Area } from "@/types/Area";

/** A click without dragging creates a one-hour item; a drag creates exactly the range. */
const CLICK_LENGTH_MINUTES = 60;

/** One day of the hour grid: hour lines, positioned items, the now line, click-drag to create. */
export function DayColumn({
  date,
  dayStart,
  positioned,
  areas,
  ctx,
}: {
  date: string;
  dayStart: Date;
  positioned: PositionedItem[];
  areas: Map<string, Area>;
  ctx: DayContext;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId(date) });
  const openNew = useEditorStore((state) => state.openNew);
  const [draft, setDraft] = useState<{ from: number; to: number } | null>(null);
  const origin = useRef<number | null>(null);

  const minuteAt = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const raw = (event.clientY - rect.top) / pxPerMinute();
    return Math.min(MINUTES_PER_DAY, Math.max(0, raw));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return; // only empty grid
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = Math.floor(minuteAt(event) / SNAP_MINUTES) * SNAP_MINUTES;
    origin.current = start;
    setDraft({ from: start, to: start + SNAP_MINUTES });
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (origin.current === null) return;
    const at = snapMinutes(minuteAt(event));
    const from = Math.min(origin.current, at);
    setDraft({ from, to: Math.max(from + SNAP_MINUTES, Math.max(origin.current, at)) });
  };
  const onPointerUp = () => {
    if (origin.current === null || !draft) return;
    const isClick = draft.to - draft.from <= SNAP_MINUTES;
    const start = addMinutes(dayStart, draft.from);
    origin.current = null;
    setDraft(null);
    openNew({
      kind: "event",
      schedule: "time",
      date,
      time: format(start, "HH:mm"),
      durationMinutes: isClick ? CLICK_LENGTH_MINUTES : draft.to - draft.from,
    });
  };

  const isToday = date === ctx.today;
  const nowMinutes = (ctx.now.getTime() - dayStart.getTime()) / 60_000;

  return (
    <div
      ref={setNodeRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        origin.current = null;
        setDraft(null);
      }}
      className={cn(
        "hour-lines relative min-w-0 flex-1 border-l border-border",
        isToday && "bg-surface-2/60",
        isOver && "outline-2 -outline-offset-2 outline-accent",
      )}
      style={{ height: minutesToRem(MINUTES_PER_DAY) }}
    >
      {positioned.map((p) => (
        <EventBlock
          key={p.item.id}
          positioned={p}
          status={getItemStatus(p.item, ctx)}
          area={p.item.areaId ? areas.get(p.item.areaId) : undefined}
        />
      ))}
      {draft && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-1 left-1 rounded-sm border-2 border-accent bg-accent/15"
          style={{ top: minutesToRem(draft.from), height: minutesToRem(draft.to - draft.from) }}
        />
      )}
      {isToday && <NowLine minutes={nowMinutes} />}
    </div>
  );
}
