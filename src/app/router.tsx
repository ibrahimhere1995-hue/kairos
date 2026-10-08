import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
  type RouterHistory,
} from "@tanstack/react-router";
import { ErrorPage } from "@/app/ErrorPage";
import { NotFoundPage } from "@/app/NotFoundPage";
import { AppShell } from "@/app/shell/AppShell";
import { CalendarPage } from "@/features/calendar/CalendarPage";
import { parseCalendarSearch, type CalendarView } from "@/features/calendar/calendarView";
import { MyDayPage } from "@/features/dashboard/MyDayPage";
import { InboxPage } from "@/features/inbox/InboxPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { TrashPage } from "@/features/trash/TrashPage";

interface CalendarSearchParams {
  view?: CalendarView;
  date?: string;
}

const rootRoute = createRootRoute({
  component: AppShell,
  notFoundComponent: NotFoundPage,
  errorComponent: ErrorPage,
});

const myDayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: MyDayPage,
});
const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/calendar",
  // Optional: missing or invalid values fall back to "this week" in the page.
  validateSearch: (search: Record<string, unknown>): CalendarSearchParams => {
    const parsed = parseCalendarSearch(search, "");
    return {
      view: search.view === parsed.view ? parsed.view : undefined,
      date: parsed.date || undefined,
    };
  },
  component: CalendarPage,
});
const inboxRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/inbox",
  component: InboxPage,
});
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});
const trashRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/trash",
  component: TrashPage,
});

// Developer-only: redirected away in release builds and lazy-loaded, so it never ships to users.
const styleguideRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dev/styleguide",
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/" });
  },
  component: lazyRouteComponent(() => import("@/features/dev/Styleguide"), "Styleguide"),
});

const routeTree = rootRoute.addChildren([
  myDayRoute,
  calendarRoute,
  inboxRoute,
  settingsRoute,
  trashRoute,
  styleguideRoute,
]);

/**
 * Hash history: a desktop app has no visible URL bar, and hash URLs never depend on the
 * webview resolving deep paths to index.html. Tests pass a memory history instead.
 */
export function createAppRouter(history: RouterHistory = createHashHistory()) {
  // A crashing screen shows the error page inside the shell, so navigation keeps working.
  return createRouter({ routeTree, history, defaultErrorComponent: ErrorPage });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
