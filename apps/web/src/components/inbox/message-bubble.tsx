"use client";

import { formatMessageMeta } from "@/lib/format";
import type { Message } from "@/lib/api/types";

/**
 * A message bubble in the design's thread.
 *
 * Geometry is the design's: 16px all round with a 4px tail corner, on the
 * bottom-right for outbound and the top-left for inbound (D-015).
 *
 * D-010: text is the only supported type. A non-text inbound event is stored as
 * a typed placeholder and must be rendered as one, carrying its LINE type, so
 * the history stays complete and honest rather than showing a blank bubble.
 */
export function MessageBubble({
  message,
  contactName,
  onRetry,
}: {
  message: Message;
  contactName: string;
  onRetry?: (messageId: string) => void;
}) {
  const outbound = message.direction === "outbound";
  const isPlaceholder = message.messageType !== "text";
  const failed = message.deliveryStatus === "failed";
  const sending = message.deliveryStatus === "sending";

  return (
    <div
      data-testid="message-bubble"
      data-direction={message.direction}
      data-delivery-status={message.deliveryStatus ?? undefined}
      className={[
        "flex max-w-[560px] flex-col gap-1",
        outbound ? "items-end self-end" : "items-start self-start",
      ].join(" ")}
    >
      <div
        className={[
          "border px-3.5 py-2.5 text-[14px] leading-[1.5]",
          outbound
            ? "wc-bubble-outbound border-primary bg-primary text-[#f8fafc]"
            : "wc-bubble-inbound border-border-default bg-surface text-text-primary",
          sending ? "opacity-70" : "",
          isPlaceholder ? "italic" : "",
        ].join(" ")}
        style={failed ? { background: "#fee2e2", borderColor: "#fecaca", color: "#b91c1c" } : undefined}
      >
        {isPlaceholder ? (
          <span data-testid="unsupported-placeholder">
            Unsupported message type: {message.messageType}
          </span>
        ) : (
          message.text
        )}
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
        <span>
          {formatMessageMeta(
            outbound ? "You" : contactName,
            message.createdAt,
          )}
        </span>

        {/* D-006/D-021: the design's "sent to LINE" via-badge. */}
        {message.sentVia && (
          <span className="whitespace-nowrap rounded-[4px] border border-border-default bg-surface px-[5px] py-px font-mono text-[10px] text-[#475569]">
            sent to LINE
          </span>
        )}

        {sending && <span data-testid="delivery-sending">Sending…</span>}

        {failed && (
          <>
            <span className="text-[#b91c1c]">
              Failed{message.failureReason ? ` · ${message.failureReason}` : ""}
            </span>
            {onRetry && (
              <button
                type="button"
                onClick={() => onRetry(message.id)}
                className="rounded-[4px] border border-border-default bg-surface px-[5px] py-px font-mono text-[10px] text-[#475569] hover:bg-border-subtle"
              >
                Retry
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
