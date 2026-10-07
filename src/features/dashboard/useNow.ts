import { useEffect, useState } from "react";

/**
 * The current time, refreshed at the start of every minute and when the window becomes
 * visible again (e.g. after the laptop wakes), so statuses move from "Today" to "Now" to
 * "Slipped" on their own.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(new Date());
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    const onVisible = () => document.visibilityState === "visible" && setNow(new Date());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return now;
}
