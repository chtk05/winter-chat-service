import { fixedClock } from "@/lib/clock";
import {
  DASHBOARD_SERIES_DAYS,
  summarizeDashboard,
  type DashboardActivityRow,
  type DashboardMessageRow,
  type DashboardStore,
} from "@/lib/services/dashboard";

const NOW = new Date("2026-08-13T16:00:00.000Z");

interface StoreState {
  contacts?: number;
  unread?: number;
  active?: number;
  messages?: DashboardMessageRow[];
  activity?: DashboardActivityRow[];
}

function createStore(state: StoreState = {}) {
  const calls = { since: [] as Date[], activeSince: [] as Date[] };

  const store: DashboardStore = {
    async countContacts() {
      return state.contacts ?? 0;
    },
    async countUnreadContacts() {
      return state.unread ?? 0;
    },
    async countActiveContactsSince(since) {
      calls.activeSince.push(since);
      return state.active ?? 0;
    },
    async listMessagesSince(since) {
      calls.since.push(since);
      return state.messages ?? [];
    },
    async listRecentActivity() {
      return state.activity ?? [];
    },
  };

  return { store, calls };
}

function message(
  isoDate: string,
  direction: "inbound" | "outbound",
): DashboardMessageRow {
  return { direction, createdAt: new Date(isoDate) };
}

describe("summarizeDashboard — positive cases (T-015, D-014, D-020)", () => {
  it("returns the counts the store reports", async () => {
    const { store } = createStore({ contacts: 42, unread: 5, active: 7 });

    const summary = await summarizeDashboard("today", store, fixedClock(NOW));

    expect(summary).toMatchObject({
      range: "today",
      timezone: "Asia/Bangkok",
      totalContacts: 42,
      unread: 5,
      activeToday: 7,
    });
  });

  it("counts today's messages by direction for the `today` range", async () => {
    const { store } = createStore({
      messages: [
        message("2026-08-13T09:00:00.000Z", "inbound"),
        message("2026-08-13T10:00:00.000Z", "inbound"),
        message("2026-08-13T11:00:00.000Z", "outbound"),
        message("2026-08-12T05:00:00.000Z", "inbound"),
      ],
    });

    const summary = await summarizeDashboard("today", store, fixedClock(NOW));

    expect(summary.messages).toEqual({ inbound: 2, outbound: 1 });
  });

  it("counts the whole week for the `7d` range", async () => {
    const { store } = createStore({
      messages: [
        message("2026-08-13T09:00:00.000Z", "inbound"),
        message("2026-08-12T05:00:00.000Z", "inbound"),
        message("2026-08-09T05:00:00.000Z", "outbound"),
      ],
    });

    const summary = await summarizeDashboard("7d", store, fixedClock(NOW));

    expect(summary.messages).toEqual({ inbound: 2, outbound: 1 });
  });

  it("always returns exactly seven days in the series, whatever the range", async () => {
    for (const range of ["today", "7d"] as const) {
      const { store } = createStore();
      const summary = await summarizeDashboard(range, store, fixedClock(NOW));

      expect(summary.series).toHaveLength(DASHBOARD_SERIES_DAYS);
      expect(DASHBOARD_SERIES_DAYS).toBe(7);
    }
  });

  it("buckets messages onto their Bangkok calendar day, oldest first", async () => {
    const { store } = createStore({
      messages: [
        message("2026-08-13T09:00:00.000Z", "inbound"),
        message("2026-08-13T09:30:00.000Z", "outbound"),
        message("2026-08-11T09:00:00.000Z", "inbound"),
      ],
    });

    const summary = await summarizeDashboard("7d", store, fixedClock(NOW));

    expect(summary.series.map((day) => day.date)).toEqual([
      "2026-08-07",
      "2026-08-08",
      "2026-08-09",
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
    ]);
    expect(summary.series.at(-1)).toEqual({
      date: "2026-08-13",
      inbound: 1,
      outbound: 1,
    });
    expect(summary.series[4]).toEqual({
      date: "2026-08-11",
      inbound: 1,
      outbound: 0,
    });
  });

  it("reads activity from the start of the Bangkok day, not the UTC day", async () => {
    const { store, calls } = createStore();

    await summarizeDashboard("today", store, fixedClock(NOW));

    expect(calls.activeSince[0]).toEqual(new Date("2026-08-12T17:00:00.000Z"));
  });

  it("returns recent activity with the contact name and ISO timestamps", async () => {
    const { store } = createStore({
      activity: [
        {
          conversationId: "c-1",
          contactName: "Aom",
          direction: "inbound",
          snippet: "hello",
          at: new Date("2026-08-13T09:00:00.000Z"),
        },
      ],
    });

    const summary = await summarizeDashboard("today", store, fixedClock(NOW));

    expect(summary.recentActivity).toEqual([
      {
        conversationId: "c-1",
        contactName: "Aom",
        direction: "inbound",
        snippet: "hello",
        at: "2026-08-13T09:00:00.000Z",
      },
    ]);
  });
});

describe("summarizeDashboard — negative cases required by T-015", () => {
  it("renders ZEROS, not nulls or placeholders, when there is no data at all (§3.5)", async () => {
    const { store } = createStore();

    const summary = await summarizeDashboard("today", store, fixedClock(NOW));

    expect(summary.totalContacts).toBe(0);
    expect(summary.activeToday).toBe(0);
    expect(summary.unread).toBe(0);
    expect(summary.messages).toEqual({ inbound: 0, outbound: 0 });
    expect(summary.recentActivity).toEqual([]);

    for (const day of summary.series) {
      expect(day.inbound).toBe(0);
      expect(day.outbound).toBe(0);
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }

    expect(JSON.stringify(summary)).not.toContain("null");
  });

  it("still returns seven days when there are zero messages", async () => {
    const { store } = createStore();
    const summary = await summarizeDashboard("7d", store, fixedClock(NOW));

    expect(summary.series).toHaveLength(7);
  });

  it("renders a day with inbound but no outbound correctly", async () => {
    const { store } = createStore({
      messages: [
        message("2026-08-11T09:00:00.000Z", "inbound"),
        message("2026-08-11T10:00:00.000Z", "inbound"),
        message("2026-08-11T11:00:00.000Z", "inbound"),
        message("2026-08-11T12:00:00.000Z", "inbound"),
      ],
    });

    const summary = await summarizeDashboard("7d", store, fixedClock(NOW));

    expect(summary.series[4]).toEqual({
      date: "2026-08-11",
      inbound: 4,
      outbound: 0,
    });
  });

  it("puts a message EXACTLY at Bangkok midnight on the new day (D-014)", async () => {
    const { store } = createStore({
      messages: [message("2026-08-12T17:00:00.000Z", "inbound")],
    });

    const summary = await summarizeDashboard("today", store, fixedClock(NOW));

    expect(summary.messages.inbound).toBe(1);
    expect(summary.series.at(-1)).toMatchObject({
      date: "2026-08-13",
      inbound: 1,
    });
  });

  it("puts a message just BEFORE Bangkok midnight on the previous day (D-014)", async () => {
    const { store } = createStore({
      messages: [message("2026-08-12T16:59:59.999Z", "inbound")],
    });

    const summary = await summarizeDashboard("today", store, fixedClock(NOW));

    expect(summary.messages.inbound).toBe(0);
    expect(summary.series[5]).toMatchObject({ date: "2026-08-12", inbound: 1 });
  });

  it("ignores a message older than the window rather than folding it into the first day", async () => {
    const { store } = createStore({
      messages: [
        message("2026-07-01T09:00:00.000Z", "inbound"),
        message("2026-08-13T09:00:00.000Z", "inbound"),
      ],
    });

    const summary = await summarizeDashboard("7d", store, fixedClock(NOW));

    expect(summary.series[0]).toEqual({
      date: "2026-08-07",
      inbound: 0,
      outbound: 0,
    });
    expect(summary.series.at(-1)?.inbound).toBe(1);
  });

  it("omits `snippet` entirely for a non-text placeholder rather than inventing a label", async () => {
    const { store } = createStore({
      activity: [
        {
          conversationId: "c-1",
          contactName: "Aom",
          direction: "inbound",
          at: new Date("2026-08-13T09:00:00.000Z"),
        },
      ],
    });

    const summary = await summarizeDashboard("today", store, fixedClock(NOW));

    expect(summary.recentActivity[0]).not.toHaveProperty("snippet");
  });

  it("carries none of the metrics D-020 removed", async () => {
    const { store } = createStore();
    const summary = await summarizeDashboard("today", store, fixedClock(NOW));

    const payload = JSON.stringify(summary);
    for (const removed of [
      "topic",
      "returning",
      "reopened",
      "firstReply",
      "busiestHour",
      "30d",
    ]) {
      expect(payload).not.toContain(removed);
    }
  });
});
