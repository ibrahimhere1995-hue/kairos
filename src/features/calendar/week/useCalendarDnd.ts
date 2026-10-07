import { useMemo } from "react";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { useTranslation } from "react-i18next";
import { scheduleAfterDrag } from "@/features/calendar/dragSchedule";
import { SNAP_MINUTES } from "@/features/calendar/layout";
import { dateFromDropId, type DragData } from "@/features/calendar/week/dragData";
import { pxPerMinute } from "@/features/calendar/week/gridMetrics";
import { useRescheduleItem } from "@/features/items/api";
import type { Item } from "@/types/Item";

/** Arrow keys: up/down = one 15-minute slot, left/right = one day column. */
const keyboardCoordinates: KeyboardCoordinateGetter = (event, { currentCoordinates, context }) => {
  const slot = SNAP_MINUTES * pxPerMinute();
  const column = context.activeNode?.closest<HTMLElement>("[data-day-column]")?.offsetWidth ?? 0;
  const { x, y } = currentCoordinates;
  switch (event.code) {
    case "ArrowUp":
      return { x, y: y - slot };
    case "ArrowDown":
      return { x, y: y + slot };
    case "ArrowLeft":
      return { x: x - column, y };
    case "ArrowRight":
      return { x: x + column, y };
    default:
      return undefined;
  }
};

/** Sensors, translated screen-reader messages, and the drop handler for the hour grid. */
export function useCalendarDnd(itemsById: Map<string, Item>) {
  const { t } = useTranslation();
  const reschedule = useRescheduleItem();

  const sensors = useSensors(
    // A 5px threshold keeps a plain click as "open the item".
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // Space picks up and drops; Enter stays free for opening the item.
    useSensor(KeyboardSensor, {
      coordinateGetter: keyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  const titleOf = (id: string | number) => {
    const itemId = String(id).split(":").slice(1).join(":");
    return itemsById.get(itemId)?.title ?? "";
  };

  const announcements: Announcements = useMemo(
    () => ({
      onDragStart: ({ active }) => t("calendar.dnd.start", { title: titleOf(active.id) }),
      onDragOver: ({ active }) => t("calendar.dnd.over", { title: titleOf(active.id) }),
      onDragEnd: ({ active }) => t("calendar.dnd.end", { title: titleOf(active.id) }),
      onDragCancel: ({ active }) => t("calendar.dnd.cancel", { title: titleOf(active.id) }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- titleOf reads the latest map
    [t, itemsById],
  );

  const onDragEnd = ({ active, over, delta }: DragEndEvent) => {
    const drag = active.data.current as DragData | undefined;
    const item = drag ? itemsById.get(drag.itemId) : undefined;
    if (!drag || !item) return;
    const schedule = scheduleAfterDrag(
      item,
      drag,
      dateFromDropId(over?.id),
      delta.y / pxPerMinute(),
    );
    if (schedule) reschedule.mutate({ item, schedule });
  };

  return {
    sensors,
    onDragEnd,
    accessibility: {
      announcements,
      screenReaderInstructions: { draggable: t("calendar.dnd.instructions") },
    },
  };
}
