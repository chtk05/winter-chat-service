"use client";

import { useEffect, useRef } from "react";

import { EMPTY_WATERMARK, waitForInboxActivity } from "@/lib/api/client";

/**
 * Long-polls `/gateway/sync` so a LINE inbound message can refresh the inbox
 * as soon as the API sees it, instead of waiting for a fixed interval.
 *
 * This is not Supabase Realtime. Auth here is LINE Login + NextAuth, so the
 * wake-up goes through the same authenticated gateway every other call uses.
 * `/sync` returns no conversation payload — `onActivity` refetches those.
 *
 * Paused while the tab is hidden: an admin who tabbed away should not hold an
 * open request, and coming back triggers one immediate refresh.
 */
export function useInboxLive(onActivity: () => void): void {
  const callbackRef = useRef(onActivity);

  useEffect(() => {
    callbackRef.current = onActivity;
  });

  useEffect(() => {
    let cancelled = false;
    let abort: AbortController | null = null;
    let resumeHidden: (() => void) | null = null;

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        resumeHidden?.();
        resumeHidden = null;
      } else {
        abort?.abort();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    async function loop() {
      let since = EMPTY_WATERMARK;

      try {
        const snapshot = await waitForInboxActivity();
        if (snapshot.at) {
          since = snapshot.at;
        }
      } catch {
        // Snapshot failed — still enter the wait loop with the epoch watermark.
      }

      while (!cancelled) {
        if (document.visibilityState !== "visible") {
          await new Promise<void>((resolve) => {
            if (cancelled || document.visibilityState === "visible") {
              resolve();
              return;
            }
            resumeHidden = resolve;
          });

          if (cancelled) {
            return;
          }

          callbackRef.current();
        }

        abort = new AbortController();

        try {
          const result = await waitForInboxActivity(since, abort.signal);

          if (cancelled) {
            return;
          }

          if (result.at) {
            since = result.at;
          }

          if (result.changed) {
            callbackRef.current();
          }
        } catch (error) {
          if (cancelled || isAbortError(error)) {
            continue;
          }

          await sleep(1000);
        }
      }
    }

    void loop();

    return () => {
      cancelled = true;
      abort?.abort();
      resumeHidden?.();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
