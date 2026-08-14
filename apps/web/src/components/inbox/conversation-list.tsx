"use client";

import { ConversationRow } from "./conversation-row";
import { FilterPills, type StatusFilter } from "./filter-pills";
import type { ConversationListResponse } from "@/lib/api/types";

/**
 * T-017: the design's left pane — search box, filter pills, rows, footer count.
 *
 * Filtering and search are **server-side** (`GET /conversations` takes `status`
 * and `search`; D-021). This component renders the page it is given and reports
 * control changes upward; it does not re-filter locally, which would disagree
 * with the footer totals the server computed.
 */
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
}) {
  const items = data?.items ?? [];
  const totals = data?.totals;

  return (
    <div className="flex min-h-0 max-w-[300px] flex-1 basis-[300px] flex-col border-r border-border-default max-lg:hidden lg:min-w-[240px]">
      <div className="flex flex-col gap-2.5 border-b border-border-default p-3.5">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search people or messages…"
          aria-label="Search people or messages"
          className="h-[34px] rounded-control border border-border-default bg-surface px-3 text-[13px] outline-none focus:border-text-muted focus:shadow-[0_0_0_3px_rgba(9,9,11,0.06)]"
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

        {/*
          Negative cases (T-017): an empty result renders an empty state rather
          than a stale list or a spinner. The message distinguishes "nothing
          matched your query" from "there is nothing here at all", because those
          need different actions from the admin.
        */}
        {!loading && items.length === 0 && (
          <p className="px-2 py-6 text-center text-[13px] text-text-secondary">
            {search.trim() || filter !== "All"
              ? "No conversations match."
              : "No conversations yet."}
          </p>
        )}
      </div>

      <div className="flex-none border-t border-border-default px-3.5 py-2.5 text-[11px] text-text-muted">
        {totals
          ? `${totals.matching} of ${totals.all} conversations · ${totals.open} open`
          : ""}
      </div>
    </div>
  );
}
