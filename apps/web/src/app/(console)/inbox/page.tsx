"use client";

import { useCallback, useEffect, useState } from "react";

import { ConversationList } from "@/components/inbox/conversation-list";
import { DetailsPanel } from "@/components/inbox/details-panel";
import { ThreadPanel } from "@/components/inbox/thread-panel";
import type { StatusFilter } from "@/components/inbox/filter-pills";
import { listConversations, markRead } from "@/lib/api/client";
import type { Conversation, ConversationListResponse } from "@/lib/api/types";

export default function InboxPage() {
  const [data, setData] = useState<ConversationListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("All");
  const [active, setActive] = useState<Conversation | null>(null);
  const [listVisible, setListVisible] = useState(true);
  const [detailsVisible, setDetailsVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;

    listConversations({
      status: filter === "All" ? undefined : filter,
      search,
    })
      .then((page) => {
        if (!cancelled) setData(page);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filter, search]);

  const handleSelect = useCallback(
    (conversationId: string) => {
      const selected = data?.items.find((item) => item.id === conversationId);
      if (!selected) return;

      setActive(selected);

      if (selected.unread) {
        markRead(conversationId)
          .then(() => {
            setData((current) =>
              current
                ? {
                    ...current,
                    items: current.items.map((item) =>
                      item.id === conversationId
                        ? { ...item, unread: false }
                        : item,
                    ),
                  }
                : current,
            );
          })
          .catch(() => {});
      }
    },
    [data],
  );

  const handleConversationChange = useCallback((next: Conversation) => {
    setActive(next);
    setData((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) =>
              item.id === next.id ? { ...item, status: next.status } : item,
            ),
          }
        : current,
    );
  }, []);

  const mobilePane: "list" | "thread" | "details" = detailsVisible
    ? "details"
    : active
      ? "thread"
      : "list";

  return (
    <div className="bg-surface flex min-h-0 flex-1">
      <ConversationList
        data={data}
        search={search}
        onSearchChange={(next) => {
          setLoading(true);
          setSearch(next);
        }}
        filter={filter}
        onFilterChange={(next) => {
          setLoading(true);
          setFilter(next);
        }}
        activeId={active?.id ?? null}
        onSelect={handleSelect}
        loading={loading}
        listVisible={listVisible}
        mobileVisible={mobilePane === "list"}
      />

      <ThreadPanel
        key={active?.id ?? "none"}
        conversation={active}
        onConversationChange={handleConversationChange}
        listVisible={listVisible}
        onToggleList={() => setListVisible((value) => !value)}
        detailsVisible={detailsVisible}
        onToggleDetails={() => setDetailsVisible((value) => !value)}
        mobileVisible={mobilePane === "thread"}
        onBackToList={() => setActive(null)}
      />

      <DetailsPanel
        conversation={active}
        detailsVisible={detailsVisible}
        mobileVisible={mobilePane === "details"}
        onBack={() => setDetailsVisible(false)}
      />
    </div>
  );
}
