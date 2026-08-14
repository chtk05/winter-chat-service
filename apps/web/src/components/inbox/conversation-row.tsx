"use client";

import { StatusPill } from "./status-pill";
import { formatRowTimestamp, initialsOf } from "@/lib/format";
import type { ConversationSummary } from "@/lib/api/types";

export function ConversationRow({
  conversation,
  active,
  onSelect,
  now,
}: {
  conversation: ConversationSummary;
  active: boolean;
  onSelect: (id: string) => void;
  now?: Date;
}) {
  const { contact, status, unread, snippet, lastMessageAt, channel } =
    conversation;
  const initials = initialsOf(contact.displayName);

  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={() => onSelect(conversation.id)}
      style={{
        background: active ? "#eef2ff" : "transparent",
        borderLeftColor: active ? "#db2777" : "transparent",
      }}
      className="mb-0.5 flex w-full gap-2.5 rounded-[10px] border-l-[3px] p-2.5 text-left"
    >
      <div
        aria-hidden
        className={[
          "flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-full border text-[14px] font-medium",
          active
            ? "border-primary bg-primary text-[#f8fafc]"
            : "border-border-default bg-border-subtle text-[#475569]",
        ].join(" ")}
      >
        {contact.avatarUrl ? (
          <img
            src={contact.avatarUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="truncate text-[15px] font-semibold">
            {contact.displayName}
          </div>
          <div className="text-text-muted flex-none text-[13px]">
            {formatRowTimestamp(lastMessageAt, now)}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="text-text-secondary min-w-0 flex-1 truncate text-[14px]">
            {snippet ?? ""}
          </div>
          {unread && (
            <span
              data-testid="unread-dot"
              aria-label="Unread"
              className="bg-accent h-[7px] w-[7px] flex-none rounded-full"
            />
          )}
        </div>

        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="border-border-default rounded-[4px] border px-1.5 py-px font-mono text-[12px] text-[#475569]">
            {channel}
          </span>
          <StatusPill status={status} />
        </div>
      </div>
    </button>
  );
}
