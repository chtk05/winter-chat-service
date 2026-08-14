"use client";

import { MessageBarChart } from "./message-bar-chart";
import { StatCard } from "./stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMessageMeta } from "@/lib/format";
import type { DashboardSummary } from "@/lib/api/types";

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
    <div className="bg-bg flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-[22px] px-4 pt-5 pb-8 lg:px-6 lg:pt-7 lg:pb-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-semibold">Daily summary</h1>
            <div className="text-text-secondary mt-1 text-[15px]">
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
            className="rounded-control bg-border-subtle flex gap-1 p-1"
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
                    "rounded-chip px-3 py-1.5 text-[15px] font-medium",
                    active
                      ? "bg-surface text-text-primary shadow-[0_1px_2px_rgba(9,9,11,0.08)]"
                      : "text-text-secondary bg-transparent",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-[15px] text-[#b91c1c]">
            {error}
          </p>
        )}

        {loading && !summary && <DashboardSkeleton />}

        {summary && (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
              <StatCard label="Total contacts" value={summary.totalContacts} />
              <StatCard
                label="Active today"
                value={summary.activeToday}
                caption={`of ${summary.totalContacts} contacts`}
              />
              <StatCard label="Unread contacts" value={summary.unread} accent />
              <StatCard label="Messages in" value={summary.messages.inbound} />
              <StatCard
                label="Messages out"
                value={summary.messages.outbound}
              />
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-3">
              {summary.series && summary.series.length > 0 && (
                <MessageBarChart series={summary.series} />
              )}

              <div className="rounded-card border-border-default bg-surface border px-5 py-[18px]">
                <h2 className="mb-3.5 text-[16px] font-semibold">
                  Recent activity
                </h2>
                {summary.recentActivity.length === 0 ? (
                  <p className="text-text-secondary text-[15px]">
                    No activity yet.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {summary.recentActivity.map((entry) => (
                      <li
                        key={`${entry.conversationId}-${entry.at}`}
                        className="flex items-baseline justify-between gap-3 text-[15px]"
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
                        <span className="text-text-secondary flex-none">
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
              <div className="rounded-card border-border-default bg-surface overflow-hidden border">
                <div className="border-border-default border-b px-5 py-4">
                  <h2 className="text-[16px] font-semibold">Day by day</h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] border-collapse text-[15px]">
                    <thead>
                      <tr className="text-text-secondary text-left text-[14px]">
                        <th className="border-border-subtle border-b px-5 py-2.5 font-normal">
                          Date
                        </th>
                        <th className="border-border-subtle border-b px-3 py-2.5 font-normal">
                          In
                        </th>
                        <th className="border-border-subtle border-b px-3 py-2.5 font-normal">
                          Out
                        </th>
                        <th className="border-border-subtle border-b px-5 py-2.5 font-normal">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.series.map((day) => (
                        <tr key={day.date}>
                          <td className="border-border-subtle border-b px-5 py-3 font-medium">
                            {day.date}
                          </td>
                          <td className="border-border-subtle border-b px-3 py-3">
                            {day.inbound}
                          </td>
                          <td className="border-border-subtle border-b px-3 py-3">
                            {day.outbound}
                          </td>
                          <td className="border-border-subtle text-text-secondary border-b px-5 py-3">
                            {day.inbound + day.outbound}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div
      aria-hidden
      data-testid="dashboard-skeleton"
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="rounded-card border-border-default bg-surface flex flex-col gap-2.5 border p-4"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-14" />
          </div>
        ))}
      </div>
      <Skeleton className="rounded-card h-64 w-full" />
    </div>
  );
}
