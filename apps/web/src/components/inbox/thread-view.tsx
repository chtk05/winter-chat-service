"use client";

import { ArrowLeft } from "lucide-react";

import { MessageBubble } from "./message-bubble";
import { PanelToggle } from "./panel-toggle";
import { initialsOf, truncateLineUserId } from "@/lib/format";
import type {
  Conversation,
  ConversationStatus,
  Message,
} from "@/lib/api/types";

const STATUSES: ConversationStatus[] = ["Open", "Pending", "Closed"];

export function ThreadView({
  conversation,
  messages,
  hasMore,
  loadingMore,
  loadError,
  onLoadMore,
  onStatusChange,
  onRetryMessage,
  listVisible,
  onToggleList,
  detailsVisible,
  onToggleDetails,
  composer,
  mobileVisible = true,
  onBackToList,
}: {
  conversation: Conversation | null;
  messages: Message[];
  hasMore: boolean;
  loadingMore: boolean;
  loadError?: string | null;
  onLoadMore: () => void;
  onStatusChange: (status: ConversationStatus) => void;
  onRetryMessage?: (messageId: string) => void;
  listVisible: boolean;
  onToggleList: () => void;
  detailsVisible: boolean;
  onToggleDetails: () => void;
  composer?: React.ReactNode;
  mobileVisible?: boolean;
  onBackToList?: () => void;
}) {
  const mobileVisibilityClass = mobileVisible ? "flex" : "hidden";

  if (!conversation) {
    return (
      <div
        className={`bg-bg min-h-0 flex-1 basis-[420px] items-center justify-center lg:flex lg:min-w-[360px] ${mobileVisibilityClass}`}
      >
        <p className="text-text-secondary text-[13px]">
          Select a conversation to open its thread.
        </p>
      </div>
    );
  }

  const { contact, status } = conversation;

  return (
    <div
      className={`min-h-0 flex-1 basis-[420px] flex-col lg:flex lg:min-w-[360px] ${mobileVisibilityClass}`}
    >
      <div className="border-border-default flex min-h-[60px] flex-none items-center justify-between gap-4 border-b px-5 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {onBackToList && (
            <button
              type="button"
              onClick={onBackToList}
              aria-label="Back to conversations"
              title="Back to conversations"
              className="border-border-default hover:bg-border-subtle -ml-1 flex h-8 w-8 flex-none items-center justify-center rounded-full border lg:hidden"
            >
              <ArrowLeft aria-hidden className="h-4 w-4" />
            </button>
          )}
          <div
            aria-hidden
            className="bg-primary flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-full text-[12px] font-medium text-[#f8fafc]"
          >
            {contact.avatarUrl ? (
              <img
                src={contact.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              initialsOf(contact.displayName)
            )}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[14px] font-semibold">
              {contact.displayName}
            </h2>
            <div className="text-text-secondary truncate font-mono text-[11px]">
              {conversation.channel} · {truncateLineUserId(contact.lineUserId)}
            </div>
          </div>
        </div>

        <div className="flex flex-none items-center gap-2">
          <label className="sr-only" htmlFor="conversation-status">
            Conversation status
          </label>
          <select
            id="conversation-status"
            value={status}
            onChange={(event) =>
              onStatusChange(event.target.value as ConversationStatus)
            }
            className="rounded-control border-border-default bg-surface h-8 cursor-pointer border px-2 text-[13px] font-medium outline-none"
          >
            {STATUSES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <div className="max-lg:hidden">
            <PanelToggle
              label="List"
              pressed={listVisible}
              onToggle={onToggleList}
            />
          </div>
          <button
            type="button"
            onClick={onToggleDetails}
            aria-expanded={detailsVisible}
            aria-label={detailsVisible ? "Hide details" : "Show details"}
            title={detailsVisible ? "Hide details" : "Show details"}
            className="rounded-control border-border-default hover:bg-border-subtle flex h-8 w-8 flex-none items-center justify-center border text-[13px] font-medium"
          >
            {detailsVisible ? "»" : "«"}
          </button>
        </div>
      </div>

      <div className="bg-bg flex flex-1 flex-col gap-3.5 overflow-y-auto px-6 py-5">
        {hasMore && (
          <div className="self-center">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="rounded-pill border-border-default bg-surface hover:bg-border-subtle border px-3 py-[5px] text-[12px] text-[#475569] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingMore ? "Loading…" : "Load full history"}
            </button>
          </div>
        )}

        {loadError && (
          <p role="alert" className="self-center text-[12px] text-[#b91c1c]">
            {loadError}
          </p>
        )}

        {messages.length === 0 && !loadingMore ? (
          <p className="text-text-secondary m-auto text-[13px]">
            No messages in this conversation yet.
          </p>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.clientId ?? message.id}
              message={message}
              contactName={contact.displayName}
              onRetry={onRetryMessage}
            />
          ))
        )}
      </div>

      {composer}
    </div>
  );
}
