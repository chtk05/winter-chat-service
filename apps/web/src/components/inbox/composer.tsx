"use client";

import { useState } from "react";

import { ChannelSelector } from "./channel-selector";

/**
 * T-018: the design's composer — "Reply via" selector, input, "Send & close"
 * and "Send reply".
 *
 * D-010 records text-only in both directions, so there is no attachment,
 * sticker, or file affordance here — no upload path exists to build one on.
 */
export function Composer({
  contactName,
  onSend,
  disabled = false,
}: {
  contactName: string;
  onSend: (text: string, options: { closeAfterSend: boolean }) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");

  const trimmed = draft.trim();
  // Negative cases (T-018): empty and whitespace-only are not sendable.
  const canSend = trimmed.length > 0 && !disabled;

  const submit = (closeAfterSend: boolean) => {
    if (!canSend) return;
    onSend(trimmed, { closeAfterSend });
    setDraft("");
  };

  return (
    <div className="border-border-default bg-surface flex flex-none flex-col gap-2.5 border-t px-6 pt-3 pb-3.5">
      <ChannelSelector />

      <div className="flex flex-wrap items-center gap-2.5">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit(false);
            }
          }}
          placeholder={`Reply to ${contactName} on LINE…`}
          aria-label="Reply message"
          className="rounded-control border-border-default bg-surface focus:border-text-muted h-[38px] min-w-[200px] flex-1 basis-60 border px-3.5 text-[14px] outline-none focus:shadow-[0_0_0_3px_rgba(9,9,11,0.06)]"
        />

        <div className="ml-auto flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={!canSend}
            className="rounded-control border-border-default bg-surface text-text-primary hover:bg-border-subtle h-[38px] flex-none border px-3.5 text-[13px] font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send &amp; close
          </button>
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={!canSend}
            className="rounded-control bg-primary hover:bg-primary-hover h-[38px] flex-none px-4 text-[13px] font-medium whitespace-nowrap text-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send reply
          </button>
        </div>
      </div>
    </div>
  );
}
