"use client";

import { StatusPill } from "./status-pill";
import { formatRowTimestamp, initialsOf } from "@/lib/format";
import type { ConversationSummary } from "@/lib/api/types";

/**
 * A row in the design's conversation list: avatar, name, time, snippet, unread
 * dot, channel tag, status pill.
 *
 * The unread dot is boolean (D-007, D-027) — read state is per-contact, so there
 * is no per-row count to render.
 */
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
          "flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-full border text-[12px] font-medium",
          active
            ? "border-primary bg-primary text-[#f8fafc]"
            : "border-border-default bg-border-subtle text-[#475569]",
        ].join(" ")}
      >
        {contact.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
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
          <div className="truncate text-[13px] font-semibold">
            {contact.displayName}
          </div>
          <div className="flex-none text-[11px] text-text-muted">
            {formatRowTimestamp(lastMessageAt, now)}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1 truncate text-[12px] text-text-secondary">
            {snippet ?? ""}
          </div>
          {unread && (
            <span
              data-testid="unread-dot"
              aria-label="Unread"
              className="h-[7px] w-[7px] flex-none rounded-full bg-accent"
            />
          )}
        </div>

        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="rounded-[4px] border border-border-default px-1.5 py-px font-mono text-[10px] text-[#475569]">
            {channel}
          </span>
          <StatusPill status={status} />
        </div>
      </div>
    </button>
  );
}
