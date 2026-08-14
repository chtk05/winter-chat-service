"use client";

import { MessageBarChart } from "./message-bar-chart";
import { StatCard } from "./stat-card";
import { formatMessageMeta } from "@/lib/format";
import type { DashboardSummary } from "@/lib/api/types";

/**
 * T-019: the design's dashboard layout populated only from `GET /dashboard/summary`.
 *
 * D-020 removes, because nothing in scope produces them:
 *  - "What they asked about" (needs topic classification)
 *  - "Who they were" new/returning/reopened split
 *  - "Avg first reply", "Queries today", "Open now", "Closed today"
 *  - the 30-day range toggle — F-003 specifies today and 7 days
 *  - Download CSV, which stays out until OQ-18 records it
 *
 * The design's "Busiest hour" and "Avg reply" table columns go for the same
 * reason. Every number below comes from the response; §3.5 forbids a placeholder.
 */

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
] as const;

export function DashboardView({
  summary,
  range,
  onRangeChange,
  loading = false,
  error,
}: {
  summary: DashboardSummary | null;
  range: "today" | "7d";
  onRangeChange: (next: "today" | "7d") => void;
  loading?: boolean;
  error?: string | null;
}) {
  return (
    <div className="flex-1 overflow-y-auto bg-bg">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-[22px] px-6 pb-12 pt-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold">Daily summary</h1>
            <div className="mt-1 text-[13px] text-text-secondary">
              {summary
                ? `${new Intl.DateTimeFormat("en-GB", {
                    timeZone: "Asia/Bangkok",
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }).format(new Date(summary.generatedAt))} · LINE`
                : "LINE"}
            </div>
          </div>

          <div
            role="group"
            aria-label="Summary range"
            className="flex gap-1 rounded-control bg-border-subtle p-1"
          >
            {RANGES.map((option) => {
              const active = option.key === range;
              return (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onRangeChange(option.key)}
                  className={[
                    "rounded-chip px-3 py-1.5 text-[13px] font-medium",
                    active
                      ? "bg-surface text-text-primary shadow-[0_1px_2px_rgba(9,9,11,0.08)]"
                      : "bg-transparent text-text-secondary",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-[13px] text-[#b91c1c]">
            {error}
          </p>
        )}

        {loading && !summary && (
          <p className="text-[13px] text-text-secondary">Loading summary…</p>
        )}

        {summary && (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
              <StatCard label="Total contacts" value={summary.totalContacts} />
              <StatCard
                label="Active today"
                value={summary.activeToday}
                caption={`of ${summary.totalContacts} contacts`}
              />
              {/* D-027: the unit is contacts, and the label says so. */}
              <StatCard
                label="Unread contacts"
                value={summary.unread}
                accent
              />
              <StatCard label="Messages in" value={summary.messages.inbound} />
              <StatCard label="Messages out" value={summary.messages.outbound} />
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-3">
              {summary.series && summary.series.length > 0 && (
                <MessageBarChart series={summary.series} />
              )}

              <div className="rounded-card border border-border-default bg-surface px-5 py-[18px]">
                <h2 className="mb-3.5 text-[14px] font-semibold">
                  Recent activity
                </h2>
                {summary.recentActivity.length === 0 ? (
                  <p className="text-[13px] text-text-secondary">
                    No activity yet.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {summary.recentActivity.map((entry) => (
                      <li
                        key={`${entry.conversationId}-${entry.at}`}
                        className="flex items-baseline justify-between gap-3 text-[13px]"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden
                            style={{
                              background:
                                entry.direction === "inbound"
                                  ? "#2563eb"
                                  : "#94a3b8",
                            }}
                            className="h-2 w-2 flex-none rounded-[2px]"
                          />
                          <span className="truncate">{entry.contactName}</span>
                        </span>
                        <span className="flex-none text-text-secondary">
                          {formatMessageMeta(
                            entry.direction === "inbound" ? "in" : "out",
                            entry.at,
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {summary.series && summary.series.length > 0 && (
              <div className="overflow-hidden rounded-card border border-border-default bg-surface">
                <div className="border-b border-border-default px-5 py-4">
                  <h2 className="text-[14px] font-semibold">Day by day</h2>
                </div>

                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="text-left text-[12px] text-text-secondary">
                      <th className="border-b border-border-subtle px-5 py-2.5 font-normal">
                        Date
                      </th>
                      <th className="border-b border-border-subtle px-3 py-2.5 font-normal">
                        In
                      </th>
                      <th className="border-b border-border-subtle px-3 py-2.5 font-normal">
                        Out
                      </th>
                      <th className="border-b border-border-subtle px-5 py-2.5 font-normal">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.series.map((day) => (
                      <tr key={day.date}>
                        <td className="border-b border-border-subtle px-5 py-3 font-medium">
                          {day.date}
                        </td>
                        <td className="border-b border-border-subtle px-3 py-3">
                          {day.inbound}
                        </td>
                        <td className="border-b border-border-subtle px-3 py-3">
                          {day.outbound}
                        </td>
                        <td className="border-b border-border-subtle px-5 py-3 text-text-secondary">
                          {day.inbound + day.outbound}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
