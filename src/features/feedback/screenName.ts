import type { TFunction } from "i18next";

const SCREENS: Record<string, string> = {
  "/": "nav.myDay",
  "/calendar": "nav.calendar",
  "/inbox": "nav.inbox",
  "/habits": "nav.habits",
  "/goals": "nav.goals",
  "/templates": "nav.templates",
  "/review": "nav.review",
  "/wishlist": "nav.wishlist",
  "/settings": "nav.settings",
  "/trash": "nav.trash",
};

/** The translated name of the screen at `pathname`, or null for anything else. */
export function screenName(pathname: string, t: TFunction): string | null {
  const key = SCREENS[pathname];
  return key ? t(key) : null;
}
