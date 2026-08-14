import type { Conversation } from "@/lib/api/types";

/**
 * T-020: the details panel behind the thread-header toggle.
 *
 * D-052 (2026-08-13) unblocked this after it sat on OQ-21 since 2026-08-12. Every row
 * below comes from a field `openapi.yaml` already defines and `GET /conversations/{id}`
 * already returns — nothing here is invented (§3.2).
 *
 * D-019 is NOT reversed: assigned-to, tags and internal notes stay out of scope, and
 * OQ-35 stays open. This panel routes around that question rather than settling it.
 *
 * The design's "session id" is read as the CONVERSATION ID (D-052). That is the only
 * recorded concept it can mean — there is no session resource, and D-039 removed the one
 * that briefly existed.
 */
export function DetailsPanel({
  conversation,
}: {
  conversation: Conversation | null;
}) {
  if (!conversation) {
    return (
      <aside
        aria-label="Conversation details"
        className="border-border-default bg-surface flex w-[280px] shrink-0 flex-col border-l p-5 max-lg:hidden"
      >
        <p className="text-text-secondary text-[13px]">
          Select a conversation to see its details.
        </p>
      </aside>
    );
  }

  const { contact } = conversation;

  return (
    <aside
      aria-label="Conversation details"
      className="border-border-default bg-surface flex w-[280px] shrink-0 flex-col gap-5 overflow-y-auto border-l p-5 max-lg:hidden"
    >
      <div className="flex items-center gap-3">
        {contact.avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element --
             LINE avatar URLs are arbitrary remote hosts; next/image would need each
             one configured in next.config, which no decision records. */
          <img
            src={contact.avatarUrl}
            alt=""
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div aria-hidden className="h-10 w-10 rounded-full bg-[#e2e8f0]" />
        )}
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">
            {contact.displayName}
          </p>
          {/* D-018: always LINE. The other channels are inert chrome, not a data field. */}
          <p className="text-text-secondary text-[12px]">
            {conversation.channel}
          </p>
        </div>
      </div>

      <dl className="flex flex-col gap-3">
        <DetailRow label="LINE user">
          {/* `openapi.yaml` states outright this is "shown truncated in the details
              panel". Truncation is presentation — the API returns the full id. */}
          <span className="font-mono">
            {truncateLineUserId(contact.lineUserId)}
          </span>
        </DetailRow>

        <DetailRow label="First seen">
          {formatDate(contact.firstSeenAt)}
        </DetailRow>

        <DetailRow label="Status">{conversation.status}</DetailRow>

        <DetailRow label="Messages">{conversation.messageCount ?? 0}</DetailRow>

        <DetailRow label="Conversation">
          <span className="font-mono">{truncateId(conversation.id)}</span>
        </DetailRow>
      </dl>
    </aside>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-secondary shrink-0 text-[12px]">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[13px]">{children}</dd>
    </div>
  );
}

/** The design's `U8f2c…4471` form: first five characters, an ellipsis, last four. */
export function truncateLineUserId(lineUserId: string): string {
  if (lineUserId.length <= 10) {
    return lineUserId;
  }
  return `${lineUserId.slice(0, 5)}…${lineUserId.slice(-4)}`;
}

function truncateId(id: string): string {
  if (id.length <= 12) {
    return id;
  }
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function formatDate(iso: string): string {
  const parsed = new Date(iso);

  // A malformed timestamp renders as an em dash rather than "Invalid Date". It is a
  // formatting failure, not a value to display.
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
