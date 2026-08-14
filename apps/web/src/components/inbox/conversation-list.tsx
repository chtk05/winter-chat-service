"use client";

import { ConversationRow } from "./conversation-row";
import { FilterPills, type StatusFilter } from "./filter-pills";
import type { ConversationListResponse } from "@/lib/api/types";

export function ConversationList({
  data,
  search,
  onSearchChange,
  filter,
  onFilterChange,
  activeId,
  onSelect,
  loading = false,
  now,
  listVisible = true,
  mobileVisible = false,
}: {
  data: ConversationListResponse | null;
  search: string;
  onSearchChange: (next: string) => void;
  filter: StatusFilter;
  onFilterChange: (next: StatusFilter) => void;
  activeId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
  now?: Date;
  listVisible?: boolean;
  mobileVisible?: boolean;
}) {
  const items = data?.items ?? [];
  const totals = data?.totals;

  return (
    <div
      className={[
        "border-border-default min-h-0 flex-col border-r",
        mobileVisible ? "flex flex-1" : "hidden",
        listVisible ? "lg:flex" : "lg:hidden",
        "lg:max-w-[300px] lg:min-w-[240px] lg:flex-1 lg:basis-[300px]",
      ].join(" ")}
    >
      <div className="border-border-default flex flex-col gap-2.5 border-b p-3.5">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search people or messages…"
          aria-label="Search people or messages"
          className="rounded-control border-border-default bg-surface focus:border-text-muted h-[34px] border px-3 text-[13px] outline-none focus:shadow-[0_0_0_3px_rgba(9,9,11,0.06)]"
        />
        <FilterPills value={filter} onChange={onFilterChange} />
      </div>

      <div
        role="listbox"
        aria-label="Conversations"
        className="flex-1 overflow-y-auto p-2"
      >
        {items.map((conversation) => (
          <ConversationRow
            key={conversation.id}
            conversation={conversation}
            active={conversation.id === activeId}
            onSelect={onSelect}
            now={now}
          />
        ))}

        {!loading && items.length === 0 && (
          <p className="text-text-secondary px-2 py-6 text-center text-[13px]">
            {search.trim() || filter !== "All"
              ? "No conversations match."
              : "No conversations yet."}
          </p>
        )}
      </div>

      <div className="border-border-default text-text-muted flex-none border-t px-3.5 py-2.5 text-[11px]">
        {totals
          ? `${totals.matching} of ${totals.all} conversations · ${totals.open} open`
          : ""}
      </div>
    </div>
  );
}
