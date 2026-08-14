"use client";

import { ConversationRow } from "./conversation-row";
import { FilterPills, type StatusFilter } from "./filter-pills";
import { Skeleton } from "@/components/ui/skeleton";
import { initialsOf } from "@/lib/format";
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
  adminName,
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
  adminName?: string | null;
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
      {/* Mobile-only masthead: the desktop `TopBar` already carries the brand
          mark, so below `lg` this is the page's own "Inbox" title plus the
          live open/total counts, instead of duplicating the brand row. */}
      <div className="border-border-default flex items-center justify-between gap-3 border-b px-4 py-3.5 lg:hidden">
        <div className="min-w-0">
          <h1 className="text-[24px] leading-tight font-semibold">Inbox</h1>
          <p className="text-text-secondary truncate text-[15px]">
            {totals
              ? `${totals.open} open · ${totals.all} total · LINE`
              : "LINE"}
          </p>
        </div>
        <div
          aria-hidden
          className="border-border-default bg-border-subtle flex h-9 w-9 flex-none items-center justify-center rounded-full border text-[14px] font-medium text-[#475569]"
        >
          {adminName ? initialsOf(adminName) : "?"}
        </div>
      </div>

      <div className="border-border-default flex flex-col gap-2.5 border-b p-3.5">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search people or messages…"
          aria-label="Search people or messages"
          className="rounded-control border-border-default bg-surface focus:border-text-muted h-[34px] border px-3 text-[15px] outline-none focus:shadow-[0_0_0_3px_rgba(9,9,11,0.06)]"
        />
        <FilterPills value={filter} onChange={onFilterChange} />
      </div>

      <div
        role="listbox"
        aria-label="Conversations"
        className="flex-1 overflow-y-auto p-2"
      >
        {loading && items.length === 0 ? (
          <ConversationListSkeleton />
        ) : (
          items.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              active={conversation.id === activeId}
              onSelect={onSelect}
              now={now}
            />
          ))
        )}

        {!loading && items.length === 0 && (
          <p className="text-text-secondary px-2 py-6 text-center text-[15px]">
            {search.trim() || filter !== "All"
              ? "No conversations match."
              : "No conversations yet."}
          </p>
        )}
      </div>

      <div className="border-border-default text-text-muted flex-none border-t px-3.5 py-2.5 text-[13px]">
        {totals
          ? `${totals.matching} of ${totals.all} conversations · ${totals.open} open`
          : ""}
      </div>
    </div>
  );
}

function ConversationListSkeleton() {
  return (
    <div aria-hidden data-testid="conversation-list-skeleton">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="mb-0.5 flex w-full gap-2.5 p-2.5">
          <Skeleton className="h-8 w-8 flex-none rounded-full" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-8 flex-none" />
            </div>
            <Skeleton className="mt-1.5 h-2.5 w-36" />
            <Skeleton className="mt-2 h-3.5 w-20 rounded-[4px]" />
          </div>
        </div>
      ))}
    </div>
  );
}
