/** Every query that shows item data starts with "items", so one invalidation refreshes all. */
export const itemKeys = {
  all: ["items"] as const,
  detail: (id: string) => ["items", "detail", id] as const,
  dashboard: (today: string, weekEndDate: string) =>
    ["items", "dashboard", today, weekEndDate] as const,
  range: (start: string, end: string) => ["items", "range", start, end] as const,
  unscheduled: ["items", "unscheduled"] as const,
};

export const areaKeys = {
  all: ["areas"] as const,
};
