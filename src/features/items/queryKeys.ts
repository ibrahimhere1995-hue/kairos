/** Every query that shows item data starts with "items", so one invalidation refreshes all. */
export const itemKeys = {
  all: ["items"] as const,
  detail: (id: string) => ["items", "detail", id] as const,
  dashboard: (today: string) => ["items", "dashboard", today] as const,
  range: (start: string, end: string) => ["items", "range", start, end] as const,
};

export const areaKeys = {
  all: ["areas"] as const,
};
