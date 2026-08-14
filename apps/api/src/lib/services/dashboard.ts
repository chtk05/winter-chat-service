import type { Clock } from "@/lib/clock";
import {
  DASHBOARD_TIME_ZONE,
  recentDayKeys,
  startOfZonedDay,
  zonedDayKey,
} from "@/lib/time/calendar";
import type { MessageDirection } from "@/lib/services/chat-types";

/**
 * T-015: the stats overview. D-020 fixes the metric list — only what F-003 specifies, and
 * nothing the design showed beyond it. D-014 fixes calendar days as Asia/Bangkok.
 *
 * Empty data yields ZEROS, never placeholders or nulls (§3.5, and T-019 asserts it on the
 * rendering side too).
 */
export const DASHBOARD_SERIES_DAYS = 7;

export type DashboardRange = "today" | "7d";

export function isDashboardRange(value: unknown): value is DashboardRange {
  return value === "today" || value === "7d";
}

/** One message reduced to what the summary needs; the store does the narrowing. */
export interface DashboardMessageRow {
  direction: MessageDirection;
  createdAt: Date;
}

export interface DashboardActivityRow {
  conversationId: string;
  contactName: string;
  direction: MessageDirection;
  snippet?: string;
  at: Date;
}

export interface DashboardStore {
  countContacts(): Promise<number>;
  /** D-027: contacts holding at least one unread inbound message, not messages. */
  countUnreadContacts(): Promise<number>;
  /** Contacts with a message in EITHER direction since the given instant (D-014). */
  countActiveContactsSince(since: Date): Promise<number>;
  /** Every message at or after `since`, narrowed to direction and timestamp. */
  listMessagesSince(since: Date): Promise<DashboardMessageRow[]>;
  listRecentActivity(take: number): Promise<DashboardActivityRow[]>;
}

export interface DashboardSummaryDto {
  range: DashboardRange;
  generatedAt: string;
  timezone: string;
  totalContacts: number;
  activeToday: number;
  unread: number;
  messages: { inbound: number; outbound: number };
  series: Array<{ date: string; inbound: number; outbound: number }>;
  recentActivity: Array<{
    conversationId: string;
    contactName: string;
    direction: MessageDirection;
    snippet?: string;
    at: string;
  }>;
}

export const RECENT_ACTIVITY_LIMIT = 10;

export async function summarizeDashboard(
  range: DashboardRange,
  store: DashboardStore,
  clock: Clock,
): Promise<DashboardSummaryDto> {
  const now = clock.now();
  const startOfToday = startOfZonedDay(now);

  // The series is ALWAYS seven days, whatever the range: `openapi.yaml` describes it as
  // "7 calendar days (D-020)" unconditionally, and the design's chart has seven bars.
  // The range selects which window `messages` totals, not how long the chart is.
  const dayKeys = recentDayKeys(now, DASHBOARD_SERIES_DAYS);
  const startOfSeries = startOfZonedDay(
    new Date(
      startOfToday.getTime() -
        (DASHBOARD_SERIES_DAYS - 1) * 24 * 60 * 60 * 1000,
    ),
  );

  const [totalContacts, unread, activeToday, seriesMessages, recentActivity] =
    await Promise.all([
      store.countContacts(),
      store.countUnreadContacts(),
      store.countActiveContactsSince(startOfToday),
      store.listMessagesSince(startOfSeries),
      store.listRecentActivity(RECENT_ACTIVITY_LIMIT),
    ]);

  const series = buildSeries(dayKeys, seriesMessages);

  // `messages` follows the requested range; the seven-day read above already contains
  // today's messages, so there is no second query for the `today` case.
  const counted =
    range === "today"
      ? seriesMessages.filter((message) => message.createdAt >= startOfToday)
      : seriesMessages;

  return {
    range,
    generatedAt: now.toISOString(),
    timezone: DASHBOARD_TIME_ZONE,
    totalContacts,
    activeToday,
    unread,
    messages: {
      inbound: counted.filter((m) => m.direction === "inbound").length,
      outbound: counted.filter((m) => m.direction === "outbound").length,
    },
    series,
    recentActivity: recentActivity.map((entry) => ({
      conversationId: entry.conversationId,
      contactName: entry.contactName,
      direction: entry.direction,
      ...(entry.snippet === undefined ? {} : { snippet: entry.snippet }),
      at: entry.at.toISOString(),
    })),
  };
}

function buildSeries(
  dayKeys: readonly string[],
  messages: readonly DashboardMessageRow[],
): DashboardSummaryDto["series"] {
  // Seeded with every day at zero FIRST, so a day with no traffic still appears. Building
  // from the messages instead would silently drop quiet days and shorten the chart.
  const byDay = new Map(
    dayKeys.map((date) => [date, { date, inbound: 0, outbound: 0 }]),
  );

  for (const message of messages) {
    const bucket = byDay.get(zonedDayKey(message.createdAt));

    // A message outside the seven-day window is ignored rather than folded into an edge
    // day, which would misreport the boundary the D-014 tests are about.
    if (bucket) {
      bucket[message.direction] += 1;
    }
  }

  return dayKeys.map((date) => byDay.get(date)!);
}
