"use client";

import { useEffect, useRef } from "react";

/**
 * Runs `callback` on an interval, skipping a tick entirely while the tab is
 * hidden — an admin who has tabbed away generates no polling traffic for a
 * chat they aren't looking at. Fires one immediate call the moment the tab
 * becomes visible again, so returning to it never waits out a full interval
 * for fresh data.
 *
 * `callback` is read through a ref updated every render (not during render —
 * inside an effect, so it stays a "read outside render" access) rather than
 * being an effect dependency, so changing what the callback closes over does
 * not tear down and restart the underlying timer.
 */
export function useVisibleInterval(
  callback: () => void,
  intervalMs: number,
): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") {
        callbackRef.current();
      }
    };

    const interval = setInterval(tick, intervalMs);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        callbackRef.current();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs]);
}
