import { DEFAULT_SETTINGS } from "@/lib/api/settings";
import { mockIPC } from "@tauri-apps/api/mocks";
import type { Area } from "@/types/Area";
import type { Dashboard } from "@/types/Dashboard";

export type Call = { cmd: string; args: Record<string, unknown> };
type Handler = (args: Record<string, unknown>) => unknown;

export const testAreas: Area[] = [
  {
    id: "a1",
    name: "Work",
    color: "area.work",
    icon: "briefcase",
    sortOrder: 0,
    isArchived: false,
  },
  {
    id: "a2",
    name: "Health",
    color: "area.health",
    icon: "activity",
    sortOrder: 1,
    isArchived: false,
  },
];

export const emptyDashboard: Dashboard = { today: [], overdue: [], thisWeek: [], doneToday: [] };

/**
 * Fake Rust backend for component tests: sensible empty answers for every command,
 * overridable per test. Returns the list of calls made, for assertions.
 */
export function mockBackend(overrides: Record<string, Handler> = {}): Call[] {
  const calls: Call[] = [];
  const defaults: Record<string, Handler> = {
    list_areas: () => testAreas,
    get_dashboard: () => emptyDashboard,
    list_items: () => [],
    set_checklist: () => [],
    list_trash: () => [],
    list_unscheduled: () => [],
    get_settings: () => ({ ...DEFAULT_SETTINGS }),
    main_window_ready: () => null,
    list_backups: () => [],
    get_backup_settings: () => ({ folder: null, lastBackupAt: null, lastFailureAt: null }),
  };
  mockIPC((cmd, args) => {
    const payload = (args ?? {}) as Record<string, unknown>;
    calls.push({ cmd, args: payload });
    const handler = overrides[cmd] ?? defaults[cmd];
    return handler ? handler(payload) : null;
  });
  return calls;
}
