"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

import { ConversationList } from "@/components/inbox/conversation-list";
import { DetailsPanel } from "@/components/inbox/details-panel";
import { ThreadPanel } from "@/components/inbox/thread-panel";
import type { StatusFilter } from "@/components/inbox/filter-pills";
import { toastManager } from "@/components/ui/toast";
import { useVisibleInterval } from "@/lib/hooks/use-visible-interval";
import { getConversation, listConversations, markRead } from "@/lib/api/client";
import type { Conversation, ConversationListResponse } from "@/lib/api/types";
import {
  detectNewActivity,
  snapshotConversations,
  type KnownConversationState,
} from "@/lib/thread/activity";

/**
 * "Live" here means polling through the SAME authenticated `/gateway` path every
 * other request already uses, not a push-based Supabase Realtime subscription.
 * Real Realtime needs the public anon key readable by Postgres row-level security,
 * and this app has no way for RLS to tell "an authenticated WinterChat member" apart
 * from anyone else holding that (page-bundled, effectively public) key — auth here
 * is LINE Login + NextAuth, not Supabase Auth. Raised directly and confirmed:
 * polling is the accepted tradeoff, not an oversight.
 *
 * Paused entirely while the tab is hidden (`useVisibleInterval`) — an admin who
 * tabbed away should not generate a request every few seconds for a chat they
 * are not looking at, and this was visibly the bulk of the request volume in
 * the user's own network tab.
 */
const POLL_INTERVAL_MS = 8000;

function InboxScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const [data, setData] = useState<ConversationListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("All");
  const [active, setActive] = useState<Conversation | null>(null);
  const [listVisible, setListVisible] = useState(true);
  const [detailsVisible, setDetailsVisible] = useState(true);

  /**
   * Deep-links from `GlobalSearch` (or anywhere else) land at `/inbox?open=<id>`.
   * Fetched directly by id rather than looked up in `data.items`, so this works
   * even when the target conversation is not in whatever filter/page the list
   * happens to have loaded. The param is stripped from the URL once consumed so
   * a later reload of `/inbox` (no `open`) does not keep re-opening it.
   */
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId) return;

    let cancelled = false;

    getConversation(openId)
      .then((conversation) => {
        if (cancelled) return;
        setActive(conversation);
        if (conversation.unread) {
          markRead(conversation.id).catch(() => {});
        }
      })
      .catch(() => {
        // A deep link to a conversation that no longer resolves (deleted,
        // wrong id) just leaves the inbox at its default state rather than
        // surfacing an error for a link the admin may have bookmarked.
      })
      .finally(() => {
        if (!cancelled) router.replace("/inbox");
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = active?.id ?? null;
  }, [active]);

  /** Last-seen unread state per conversation id, used only to detect what's NEW on
   * a poll tick. Reset whenever the filter/search context changes — comparing
   * across two different queries would be meaningless. */
  const knownRef = useRef<Map<string, KnownConversationState>>(new Map());

  useEffect(() => {
    let cancelled = false;
    knownRef.current = new Map();

    listConversations({
      status: filter === "All" ? undefined : filter,
      search,
    })
      .then((page) => {
        if (cancelled) return;
        setData(page);
        knownRef.current = snapshotConversations(page.items);
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

  /**
   * Polls the same list in the background so newly-arrived conversations and
   * messages show up without a manual reload. Runs alongside the effect above,
   * not instead of it — that one owns "the user changed what they're looking at"
   * and the loading skeleton; this one is the quiet periodic refresh.
   */
  const pollConversations = useCallback(() => {
    listConversations({
      status: filter === "All" ? undefined : filter,
      search,
    })
      .then((page) => {
        const activity = detectNewActivity(
          knownRef.current,
          page.items,
          activeIdRef.current,
        );

        for (const entry of activity) {
          toastManager.add({
            title: entry.isNewConversation ? "New conversation" : "New message",
            description: entry.displayName,
            timeout: 6000,
          });
        }

        knownRef.current = snapshotConversations(page.items);
        setData(page);
      })
      .catch(() => {
        // A failed background poll just leaves the list as it was; the next
        // tick tries again. Surfacing an error here would be noisier than
        // useful for a check that runs every few seconds.
      });
  }, [filter, search]);

  useVisibleInterval(pollConversations, POLL_INTERVAL_MS);

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

  /**
   * `detailsVisible` defaults to `true` for desktop's three-pane layout, and stays
   * true even with no conversation selected. On mobile that must NOT take priority
   * over "no conversation selected" — otherwise first load shows DetailsPanel's
   * empty "Select a conversation..." state instead of the inbox list.
   */
  const mobilePane: "list" | "thread" | "details" = !active
    ? "list"
    : detailsVisible
      ? "details"
      : "thread";

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
        adminName={session?.user?.name}
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

export default function InboxPage() {
  return (
    <Suspense fallback={null}>
      <InboxScreen />
    </Suspense>
  );
}
