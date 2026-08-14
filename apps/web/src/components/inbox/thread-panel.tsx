"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Composer } from "./composer";
import { ThreadView } from "./thread-view";
import { toastManager } from "@/components/ui/toast";
import {
  markFailed,
  mergeOlderPage,
  optimisticImageMessage,
  optimisticMessage,
  upsertMessage,
} from "@/lib/thread/messages";
import {
  listMessages,
  retryMessage,
  sendMessage,
  setConversationStatus,
  uploadImage,
} from "@/lib/api/client";
import type {
  Conversation,
  ConversationStatus,
  Message,
} from "@/lib/api/types";

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
  mobileVisible = true,
  onBackToList,
}: {
  conversation: Conversation | null;
  onConversationChange: (conversation: Conversation) => void;
  listVisible: boolean;
  onToggleList: () => void;
  detailsVisible: boolean;
  onToggleDetails: () => void;
  idFactory?: IdFactory;
  now?: () => Date;
  mobileVisible?: boolean;
  onBackToList?: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [oldestCursor, setOldestCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const pendingImageFiles = useRef(new Map<string, File>());

  const conversationId = conversation?.id ?? null;

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

      setMessages((current) => upsertMessage(current, optimistic));

      try {
        const persisted = await sendMessage(conversation.id, {
          text,
          clientId,
          closeAfterSend,
        });
        setMessages((current) => upsertMessage(current, persisted));

        if (closeAfterSend) {
          onConversationChange({ ...conversation, status: "Closed" });
        }
      } catch {
        setMessages((current) =>
          markFailed(current, clientId, "Not delivered"),
        );
      }
    },
    [conversation, idFactory, now, onConversationChange],
  );

  const attemptImageSend = useCallback(
    async (conversationId: string, clientId: string, file: File) => {
      try {
        const { url: mediaUrl } = await uploadImage(file);
        const persisted = await sendMessage(conversationId, {
          mediaUrl,
          clientId,
        });
        pendingImageFiles.current.delete(clientId);
        setMessages((current) => upsertMessage(current, persisted));
      } catch {
        setMessages((current) =>
          markFailed(current, clientId, "Not delivered"),
        );
      }
    },
    [],
  );

  const handleSendImage = useCallback(
    (file: File) => {
      if (!conversation) return;

      const clientId = idFactory();
      pendingImageFiles.current.set(clientId, file);

      const previewUrl = URL.createObjectURL(file);
      const optimistic = optimisticImageMessage({
        conversationId: conversation.id,
        previewUrl,
        clientId,
        now: now(),
      });

      setMessages((current) => upsertMessage(current, optimistic));
      void attemptImageSend(conversation.id, clientId, file);
    },
    [conversation, idFactory, now, attemptImageSend],
  );

  const handleRetry = useCallback(
    async (messageId: string) => {
      if (!conversation) return;

      const target = messages.find((message) => message.id === messageId);
      if (!target) return;

      const neverReachedServer =
        target.clientId != null && target.id === target.clientId;

      if (neverReachedServer && target.messageType === "image") {
        const file = pendingImageFiles.current.get(target.clientId!);
        if (!file) {
          setMessages((current) =>
            upsertMessage(current, {
              ...target,
              deliveryStatus: "failed",
              failureReason: "Choose the image again to retry.",
            }),
          );
          return;
        }

        setMessages((current) =>
          upsertMessage(current, {
            ...target,
            deliveryStatus: "sending",
            failureReason: null,
          }),
        );
        await attemptImageSend(conversation.id, target.clientId!, file);
        return;
      }

      setMessages((current) =>
        upsertMessage(current, {
          ...target,
          deliveryStatus: "sending",
          failureReason: null,
        }),
      );

      try {
        const persisted = neverReachedServer
          ? await sendMessage(conversation.id, {
              text: target.text ?? "",
              clientId: target.clientId!,
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
    [conversation, messages, attemptImageSend],
  );

  const handleStatusChange = useCallback(
    async (status: ConversationStatus) => {
      if (!conversation) return;
      try {
        const updated = await setConversationStatus(conversation.id, status);
        onConversationChange(updated);
        toastManager.add({
          title: `Status changed to ${status}`,
          type: "success",
          timeout: 6000,
        });
      } catch {
        onConversationChange({ ...conversation });
        toastManager.add({
          title: "Could not change status",
          description: "Please try again.",
          type: "error",
          timeout: 8000,
        });
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
      mobileVisible={mobileVisible}
      onBackToList={onBackToList}
      composer={
        conversation ? (
          <Composer
            contactName={conversation.contact.displayName}
            onSend={handleSend}
            onSendImage={handleSendImage}
          />
        ) : null
      }
    />
  );
}
