"use client";

import { formatMessageMeta } from "@/lib/format";
import type { Message } from "@/lib/api/types";

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
  const isImage = message.messageType === "image";
  const isPlaceholder = !isImage && message.messageType !== "text";
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
          "border text-[14px] leading-[1.5]",
          isImage ? "overflow-hidden" : "px-3.5 py-2.5",
          outbound
            ? "wc-bubble-outbound border-primary bg-primary text-[#f8fafc]"
            : "wc-bubble-inbound border-border-default bg-surface text-text-primary",
          sending ? "opacity-70" : "",
          isPlaceholder ? "italic" : "",
        ].join(" ")}
        style={
          failed
            ? {
                background: "#fee2e2",
                borderColor: "#fecaca",
                color: "#b91c1c",
              }
            : undefined
        }
      >
        {isImage ? (
          message.mediaUrl ? (
            <img
              src={message.mediaUrl}
              alt=""
              className="block max-h-[320px] w-full object-cover"
            />
          ) : (
            <span data-testid="image-unavailable" className="px-3.5 py-2.5">
              Image unavailable
            </span>
          )
        ) : isPlaceholder ? (
          <span data-testid="unsupported-placeholder">
            Unsupported message type: {message.messageType}
          </span>
        ) : (
          message.text
        )}
      </div>

      <div className="text-text-muted flex items-center gap-1.5 text-[11px]">
        <span>
          {formatMessageMeta(outbound ? "You" : contactName, message.createdAt)}
        </span>

        {message.sentVia && (
          <span className="border-border-default bg-surface rounded-[4px] border px-[5px] py-px font-mono text-[10px] whitespace-nowrap text-[#475569]">
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
                className="border-border-default bg-surface hover:bg-border-subtle rounded-[4px] border px-[5px] py-px font-mono text-[10px] text-[#475569]"
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
