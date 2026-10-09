import type { BestHours } from "@/types/BestHours";

const pad = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** "09:00–11:00": what Plan my day passes on (A5). */
export const hoursRange = (b: BestHours) => `${pad(b.startHour)}–${pad(b.endHour)}`;
