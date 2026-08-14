"use client";

import type { ConversationStatus } from "@/lib/api/types";

export type StatusFilter = "All" | ConversationStatus;

export const STATUS_FILTERS: StatusFilter[] = [
  "All",
  "Open",
  "Pending",
  "Closed",
];

export function FilterPills({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (next: StatusFilter) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filter by status"
      className="flex flex-wrap gap-1.5"
    >
      {STATUS_FILTERS.map((filter) => {
        const active = filter === value;
        return (
          <button
            key={filter}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(filter)}
            className={[
              "rounded-pill border px-2.5 py-1 text-[14px] font-medium whitespace-nowrap",
              active
                ? "border-primary bg-primary text-[#f8fafc]"
                : "border-border-default bg-surface text-[#475569]",
            ].join(" ")}
          >
            {filter}
          </button>
        );
      })}
    </div>
  );
}
