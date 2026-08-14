"use client";

import { useEffect, useRef } from "react";

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
