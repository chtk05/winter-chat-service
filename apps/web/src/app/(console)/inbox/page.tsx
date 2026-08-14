"use client";

import { useCallback, useEffect, useState } from "react";

import { ConversationList } from "@/components/inbox/conversation-list";
import { DetailsPanel } from "@/components/inbox/details-panel";
import { ThreadPanel } from "@/components/inbox/thread-panel";
import type { StatusFilter } from "@/components/inbox/filter-pills";
import { listConversations, markRead } from "@/lib/api/client";
import type { Conversation, ConversationListResponse } from "@/lib/api/types";

/**
 * F-002 inbox. The design's three panes: conversation list, thread, details.
 *
 * The details panel is built (T-020), unblocked by D-052 after sitting on OQ-21
 * since 2026-08-12. It shows only fields `openapi.yaml` already defines. D-019 is
 * not reversed — assigned-to, tags and internal notes stay out of scope, and
 * OQ-35 stays open.
 */
export default function InboxPage() {
  const [data, setData] = useState<ConversationListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("All");
  const [active, setActive] = useState<Conversation | null>(null);
  const [listVisible, setListVisible] = useState(true);
  const [detailsVisible, setDetailsVisible] = useState(false);

  // `loading` is raised by the handlers below rather than here: setting state
  // synchronously inside an effect cascades renders (React `set-state-in-effect`).
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

  /** D-007: opening a thread marks all of that contact's inbound messages read. */
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
          .catch(() => {
            // The badge stays until the server confirms — read state is
            // workspace-wide (D-009), so a failed call must not fake it.
          });
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

  return (
    <div className="bg-surface flex min-h-0 flex-1">
      {listVisible && (
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
        />
      )}

      {/* Keyed so switching threads remounts with empty message state. */}
      <ThreadPanel
        key={active?.id ?? "none"}
        conversation={active}
        onConversationChange={handleConversationChange}
        listVisible={listVisible}
        onToggleList={() => setListVisible((value) => !value)}
        detailsVisible={detailsVisible}
        onToggleDetails={() => setDetailsVisible((value) => !value)}
      />

      {detailsVisible && <DetailsPanel conversation={active} />}
    </div>
  );
}
