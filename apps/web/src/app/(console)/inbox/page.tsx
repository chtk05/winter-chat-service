"use client";

import { useCallback, useEffect, useState } from "react";

import { ConversationList } from "@/components/inbox/conversation-list";
import { ThreadPanel } from "@/components/inbox/thread-panel";
import type { StatusFilter } from "@/components/inbox/filter-pills";
import { listConversations, markRead } from "@/lib/api/client";
import type {
  Conversation,
  ConversationListResponse,
} from "@/lib/api/types";

/**
 * F-002 inbox. The design's three panes: conversation list, thread, details.
 *
 * **The details panel is not built.** T-020 is blocked on OQ-21: D-019 removed
 * assigned-to, tags and internal notes, which was most of what the design put in
 * that panel, and the "session id" field it leaves behind maps to no recorded
 * concept. Scoping its contents would mean inventing them (§3.2). The toggle is
 * in T-007's scope and is wired; the panel it reveals is T-020's deliverable.
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
    <div className="flex min-h-0 flex-1 bg-surface">
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
    </div>
  );
}
