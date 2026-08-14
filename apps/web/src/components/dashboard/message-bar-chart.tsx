import type { DashboardSummary } from "@/lib/api/types";

export function MessageBarChart({
  series,
}: {
  series: NonNullable<DashboardSummary["series"]>;
}) {
  const totals = series.map((day) => day.inbound + day.outbound);
  const max = Math.max(...totals, 0);

  return (
    <div className="rounded-card border-border-default bg-surface border px-5 pt-[18px] pb-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[14px] font-semibold">Messages per day</h2>
        <div className="text-text-secondary text-[12px]">Last 7 days</div>
      </div>

      <div className="mt-5 flex h-40 items-end gap-1.5">
        {series.map((day, index) => {
          const total = totals[index];
          const height = max > 0 ? Math.round((total / max) * 100) : 0;
          const isToday = index === series.length - 1;

          return (
            <div
              key={day.date}
              className="flex h-full flex-1 flex-col items-center gap-2"
            >
              <div className="flex min-h-0 w-full flex-1 items-end">
                <div
                  data-testid="chart-bar"
                  data-date={day.date}
                  data-total={total}
                  title={`${day.date}: ${day.inbound} in · ${day.outbound} out`}
                  style={{
                    height: `${height}%`,
                    background: isToday ? "#db2777" : "#e2e8f0",
                  }}
                  className="min-h-0.5 w-full rounded-[4px]"
                />
              </div>
              <div className="text-text-muted flex-none font-mono text-[10px]">
                {day.date.slice(-2)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
