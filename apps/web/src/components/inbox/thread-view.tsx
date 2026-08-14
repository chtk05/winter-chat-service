"use client";

import { MessageBubble } from "./message-bubble";
import { PanelToggle } from "./panel-toggle";
import { initialsOf, truncateLineUserId } from "@/lib/format";
import type {
  Conversation,
  ConversationStatus,
  Message,
} from "@/lib/api/types";

/**
 * T-007: the design's thread pane — header with the D-019 status select and the
 * List/Details toggles, message bubbles, and the "Load full history" control.
 *
 * D-026 fixes paging at 30 initial / 50 per page. The control is hidden when the
 * server reports no more history, and is disabled while a page is in flight so it
 * cannot fire twice.
 *
 * The header's meta line is `channel · truncated LINE user id`. That is not the
 * unresolved "session id" of OQ-21 — `openapi.yaml` states outright that
 * `Contact.lineUserId` is "shown truncated in the details panel (U8f2c…4471)",
 * so the value is recorded. OQ-21 concerns what the *details panel* contains.
 */

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
}) {
  if (!conversation) {
    return (
      <div className="bg-bg flex min-h-0 min-w-[360px] flex-1 basis-[420px] items-center justify-center">
        <p className="text-text-secondary text-[13px]">
          Select a conversation to open its thread.
        </p>
      </div>
    );
  }

  const { contact, status } = conversation;

  return (
    <div className="flex min-h-0 min-w-[360px] flex-1 basis-[420px] flex-col">
      <div className="border-border-default flex min-h-[60px] flex-none items-center justify-between gap-4 border-b px-5 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            aria-hidden
            className="bg-primary flex h-8 w-8 flex-none items-center justify-center rounded-full text-[12px] font-medium text-[#f8fafc]"
          >
            {initialsOf(contact.displayName)}
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

          <PanelToggle
            label="List"
            pressed={listVisible}
            onToggle={onToggleList}
          />
          <PanelToggle
            label="Details"
            pressed={detailsVisible}
            onToggle={onToggleDetails}
          />
        </div>
      </div>

      <div className="bg-bg flex flex-1 flex-col gap-3.5 overflow-y-auto px-6 py-5">
        {/* D-026: only offered when the server says there is more history. */}
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
          // Negative case (T-007): an empty thread renders an empty state, not a spinner.
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
