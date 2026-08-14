"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import { listConversations } from "@/lib/api/client";
import { initialsOf } from "@/lib/format";
import type { ConversationSummary } from "@/lib/api/types";

const DEBOUNCE_MS = 300;

/**
 * Reachable from anywhere in the console (mounted once in `TopBar`, which
 * every `(console)` route renders) — not a new backend search: it calls the
 * SAME `GET /conversations?search=` the inbox list already uses, just from
 * outside the inbox page. Picking a result deep-links into that conversation
 * via `/inbox?open=<id>` rather than requiring it to already be present in
 * whatever filter/page the inbox happens to have loaded.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    // Empty query / closed: nothing to fetch. Stale `results` from a previous
    // query are left in state rather than cleared here (which would itself be
    // a synchronous setState-in-effect) — harmless, since the render below
    // checks the empty-query case FIRST and never shows them.
    if (!open || query.trim().length === 0) {
      return;
    }

    let cancelled = false;

    const timeout = setTimeout(() => {
      setLoading(true);
      listConversations({ search: query })
        .then((page) => {
          if (!cancelled) setResults(page.items);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [open, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
  }, []);

  const selectResult = useCallback(
    (conversationId: string) => {
      close();
      router.push(`/inbox?open=${conversationId}`);
    },
    [close, router],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Search conversations"
        aria-label="Search conversations"
        className="border-border-default bg-border-subtle hover:bg-border-default flex h-7 w-7 flex-none items-center justify-center rounded-full border text-[#475569]"
      >
        <Search aria-hidden className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search conversations"
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[10vh]"
          onClick={close}
        >
          <div
            className="bg-surface w-full max-w-[480px] overflow-hidden rounded-[14px] shadow-[0_20px_60px_-20px_rgba(9,9,11,0.4)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-border-default flex items-center gap-2.5 border-b px-4 py-3">
              <Search
                aria-hidden
                className="text-text-muted h-4 w-4 flex-none"
              />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") close();
                }}
                placeholder="Search people or messages…"
                aria-label="Search people or messages"
                className="min-w-0 flex-1 text-[16px] outline-none"
              />
              <button
                type="button"
                onClick={close}
                aria-label="Close search"
                className="text-text-muted hover:text-text-secondary flex-none"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[360px] overflow-y-auto p-2">
              {query.trim().length === 0 ? (
                <p className="text-text-secondary px-2 py-6 text-center text-[15px]">
                  Search by contact name or message text.
                </p>
              ) : loading ? (
                <p className="text-text-secondary px-2 py-6 text-center text-[15px]">
                  Searching…
                </p>
              ) : results.length === 0 ? (
                <p className="text-text-secondary px-2 py-6 text-center text-[15px]">
                  No conversations match.
                </p>
              ) : (
                results.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => selectResult(conversation.id)}
                    className="hover:bg-border-subtle flex w-full items-center gap-2.5 rounded-[10px] p-2.5 text-left"
                  >
                    <div
                      aria-hidden
                      className="border-border-default bg-border-subtle flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-full border text-[14px] font-medium text-[#475569]"
                    >
                      {conversation.contact.avatarUrl ? (
                        <img
                          src={conversation.contact.avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initialsOf(conversation.contact.displayName)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-semibold">
                        {conversation.contact.displayName}
                      </div>
                      <div className="text-text-secondary truncate text-[14px]">
                        {conversation.snippet ?? ""}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
