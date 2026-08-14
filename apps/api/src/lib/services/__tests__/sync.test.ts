import { fixedClock } from "@/lib/clock";
import {
  parseSince,
  waitForActivity,
  type SyncStore,
} from "@/lib/services/sync";

const SINCE = new Date("2026-08-14T08:00:00.000Z");
const LATER = new Date("2026-08-14T08:00:01.000Z");

function store(latest: Date | null | (() => Date | null)): SyncStore {
  return {
    async latestActivityAt() {
      return typeof latest === "function" ? latest() : latest;
    },
  };
}

describe("parseSince", () => {
  it("treats a missing or empty value as a snapshot (no wait)", () => {
    expect(parseSince(null)).toBeNull();
    expect(parseSince("")).toBeNull();
  });

  it("parses an RFC 3339 timestamp", () => {
    expect(parseSince("2026-08-14T08:00:00.000Z")).toEqual(SINCE);
  });

  it("rejects a malformed timestamp", () => {
    expect(parseSince("yesterday")).toBe("invalid");
  });
});

describe("waitForActivity", () => {
  it("returns the current watermark immediately when since is omitted", async () => {
    const sleep = jest.fn();

    await expect(
      waitForActivity(null, store(SINCE), fixedClock(SINCE), { sleep }),
    ).resolves.toEqual({ changed: false, at: SINCE.toISOString() });

    expect(sleep).not.toHaveBeenCalled();
  });

  it("returns immediately when latest activity is newer than since", async () => {
    const sleep = jest.fn(async () => {
      throw new Error("should not wait");
    });

    await expect(
      waitForActivity(SINCE, store(LATER), fixedClock(SINCE), { sleep }),
    ).resolves.toEqual({ changed: true, at: LATER.toISOString() });
  });

  it("does not treat equal timestamps as new activity", async () => {
    let now = SINCE.getTime();
    const clock = { now: () => new Date(now) };

    await expect(
      waitForActivity(SINCE, store(SINCE), clock, {
        waitMs: 500,
        pollMs: 250,
        sleep: async (ms) => {
          now += ms;
        },
      }),
    ).resolves.toEqual({ changed: false, at: SINCE.toISOString() });
  });

  it("waits until a newer timestamp appears", async () => {
    let latest: Date | null = SINCE;
    let sleeps = 0;

    const result = await waitForActivity(
      SINCE,
      store(() => latest),
      {
        now: () => SINCE,
      },
      {
        waitMs: 10_000,
        pollMs: 250,
        sleep: async () => {
          sleeps += 1;
          if (sleeps === 2) {
            latest = LATER;
          }
        },
      },
    );

    expect(result).toEqual({ changed: true, at: LATER.toISOString() });
    expect(sleeps).toBe(2);
  });

  it("returns unchanged when the caller aborts", async () => {
    const signal = AbortSignal.abort();

    await expect(
      waitForActivity(SINCE, store(SINCE), fixedClock(SINCE), { signal }),
    ).resolves.toEqual({ changed: false, at: SINCE.toISOString() });
  });
});
