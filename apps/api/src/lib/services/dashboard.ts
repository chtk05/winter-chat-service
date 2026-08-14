import type { Clock } from "@/lib/clock";
import {
  DASHBOARD_TIME_ZONE,
  recentDayKeys,
  startOfZonedDay,
  zonedDayKey,
} from "@/lib/time/calendar";
import type { MessageDirection } from "@/lib/services/chat-types";

export const DASHBOARD_SERIES_DAYS = 7;

export type DashboardRange = "today" | "7d";

export function isDashboardRange(value: unknown): value is DashboardRange {
  return value === "today" || value === "7d";
}

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
  countUnreadContacts(): Promise<number>;
  countActiveContactsSince(since: Date): Promise<number>;
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
  const byDay = new Map(
    dayKeys.map((date) => [date, { date, inbound: 0, outbound: 0 }]),
  );

  for (const message of messages) {
    const bucket = byDay.get(zonedDayKey(message.createdAt));

    if (bucket) {
      bucket[message.direction] += 1;
    }
  }

  return dayKeys.map((date) => byDay.get(date)!);
}
