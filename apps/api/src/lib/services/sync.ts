import type { Clock } from "@/lib/clock";

/** Hang long enough to skip idle round-trips, short enough for Vercel hobby. */
export const SYNC_WAIT_MS = 7_000;
export const SYNC_POLL_MS = 250;

export interface SyncStore {
  latestActivityAt(): Promise<Date | null>;
}

export interface WaitForActivityOptions {
  readonly waitMs?: number;
  readonly pollMs?: number;
  readonly sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  readonly signal?: AbortSignal;
}

export interface SyncResult {
  readonly changed: boolean;
  readonly at: string | null;
}

export function parseSince(raw: string | null): Date | null | "invalid" {
  if (raw === null || raw === "") {
    return null;
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return "invalid";
  }

  return parsed;
}

export async function waitForActivity(
  since: Date | null,
  store: SyncStore,
  clock: Clock,
  options: WaitForActivityOptions = {},
): Promise<SyncResult> {
  if (since === null) {
    const latest = await store.latestActivityAt();
    return { changed: false, at: iso(latest) };
  }

  const waitMs = options.waitMs ?? SYNC_WAIT_MS;
  const pollMs = options.pollMs ?? SYNC_POLL_MS;
  const sleep = options.sleep ?? defaultSleep;
  const deadline = clock.now().getTime() + waitMs;

  for (;;) {
    if (options.signal?.aborted) {
      const latest = await store.latestActivityAt();
      return { changed: false, at: iso(latest) };
    }

    const latest = await store.latestActivityAt();

    if (latest && latest.getTime() > since.getTime()) {
      return { changed: true, at: iso(latest) };
    }

    if (clock.now().getTime() >= deadline) {
      return { changed: false, at: iso(latest) ?? since.toISOString() };
    }

    await sleep(pollMs, options.signal);
  }
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

async function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return;
  }

  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);

    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
