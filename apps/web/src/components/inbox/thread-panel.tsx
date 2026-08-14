"use client";

import { useCallback, useEffect, useState } from "react";

import { Composer } from "./composer";
import { ThreadView } from "./thread-view";
import {
  markFailed,
  mergeOlderPage,
  optimisticMessage,
  upsertMessage,
} from "@/lib/thread/messages";
import {
  listMessages,
  retryMessage,
  sendMessage,
  setConversationStatus,
} from "@/lib/api/client";
import type {
  Conversation,
  ConversationStatus,
  Message,
} from "@/lib/api/types";

/**
 * T-018 container: owns the thread's message state, the optimistic bubble, and
 * the D-019 "Send & close" atomicity rule.
 *
 * D-021 makes send **202 Accepted** — the message comes back `sending` and
 * resolves to `sent`/`failed` over Supabase Realtime (D-005), not in the
 * response. So this component never marks a message `sent` itself; it only
 * reconciles the optimistic bubble with the persisted row, or marks it `failed`
 * when the request never landed.
 */

/** Injectable so tests do not depend on a global UUID source. */
export type IdFactory = () => string;

const defaultIdFactory: IdFactory = () => crypto.randomUUID();

export function ThreadPanel({
  conversation,
  onConversationChange,
  listVisible,
  onToggleList,
  detailsVisible,
  onToggleDetails,
  idFactory = defaultIdFactory,
  now = () => new Date(),
}: {
  conversation: Conversation | null;
  onConversationChange: (conversation: Conversation) => void;
  listVisible: boolean;
  onToggleList: () => void;
  detailsVisible: boolean;
  onToggleDetails: () => void;
  idFactory?: IdFactory;
  now?: () => Date;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [oldestCursor, setOldestCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const conversationId = conversation?.id ?? null;

  /*
   * D-026: the initial page is 30; the client module owns the number.
   *
   * The parent keys this component by conversation id, so switching threads
   * remounts it with empty state. That is why the effect does not reset
   * `messages` itself — a synchronous setState in an effect body triggers the
   * cascading render React's `set-state-in-effect` rule warns about.
   */
  useEffect(() => {
    if (!conversationId) return;

    let cancelled = false;

    listMessages(conversationId)
      .then((page) => {
        if (cancelled) return;
        setMessages(page.items);
        setHasMore(page.hasMore);
        setOldestCursor(page.nextCursor ?? null);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load this conversation.");
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  /** D-026: pages of 50, and never twice at once. */
  const handleLoadMore = useCallback(async () => {
    if (!conversationId || loadingMore || !oldestCursor) return;

    setLoadingMore(true);
    setLoadError(null);
    try {
      const page = await listMessages(conversationId, { before: oldestCursor });
      setMessages((current) => mergeOlderPage(current, page.items));
      setHasMore(page.hasMore);
      setOldestCursor(page.nextCursor ?? null);
    } catch {
      setLoadError("Could not load older messages.");
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, loadingMore, oldestCursor]);

  const handleSend = useCallback(
    async (text: string, { closeAfterSend }: { closeAfterSend: boolean }) => {
      if (!conversation) return;

      const clientId = idFactory();
      const optimistic = optimisticMessage({
        conversationId: conversation.id,
        text,
        clientId,
        now: now(),
      });

      // The bubble appears before the network call, keyed by clientId.
      setMessages((current) => upsertMessage(current, optimistic));

      try {
        const persisted = await sendMessage(conversation.id, {
          text,
          clientId,
          closeAfterSend,
        });
        setMessages((current) => upsertMessage(current, persisted));

        /*
         * D-019: "Send & close" sets Closed only if the send succeeded — both,
         * or neither. The server owns the transition via `closeAfterSend`; the
         * UI reflects it only after the 202, never optimistically.
         */
        if (closeAfterSend) {
          onConversationChange({ ...conversation, status: "Closed" });
        }
      } catch {
        setMessages((current) =>
          markFailed(current, clientId, "Not delivered"),
        );
        // Status is deliberately left untouched here.
      }
    },
    [conversation, idFactory, now, onConversationChange],
  );

  const handleRetry = useCallback(
    async (messageId: string) => {
      if (!conversation) return;

      const target = messages.find((message) => message.id === messageId);
      if (!target) return;

      setMessages((current) =>
        upsertMessage(current, {
          ...target,
          deliveryStatus: "sending",
          failureReason: null,
        }),
      );

      try {
        /*
         * A bubble whose id still equals its clientId never reached the server,
         * so there is no row to retry — it is re-sent under the same clientId,
         * which D-021 makes the idempotency key. A message the server did
         * persist is retried through its own endpoint (D-013).
         */
        const persisted =
          target.clientId && target.id === target.clientId
            ? await sendMessage(conversation.id, {
                text: target.text ?? "",
                clientId: target.clientId,
              })
            : await retryMessage(messageId);

        setMessages((current) => upsertMessage(current, persisted));
      } catch {
        setMessages((current) =>
          upsertMessage(current, {
            ...target,
            deliveryStatus: "failed",
            failureReason: "Not delivered",
          }),
        );
      }
    },
    [conversation, messages],
  );

  const handleStatusChange = useCallback(
    async (status: ConversationStatus) => {
      if (!conversation) return;
      try {
        const updated = await setConversationStatus(conversation.id, status);
        onConversationChange(updated);
      } catch {
        // Negative case: a rejected change must not appear to have taken.
        onConversationChange({ ...conversation });
      }
    },
    [conversation, onConversationChange],
  );

  return (
    <ThreadView
      conversation={conversation}
      messages={messages}
      hasMore={hasMore}
      loadingMore={loadingMore}
      loadError={loadError}
      onLoadMore={handleLoadMore}
      onStatusChange={handleStatusChange}
      onRetryMessage={handleRetry}
      listVisible={listVisible}
      onToggleList={onToggleList}
      detailsVisible={detailsVisible}
      onToggleDetails={onToggleDetails}
      composer={
        conversation ? (
          <Composer
            contactName={conversation.contact.displayName}
            onSend={handleSend}
          />
        ) : null
      }
    />
  );
}
