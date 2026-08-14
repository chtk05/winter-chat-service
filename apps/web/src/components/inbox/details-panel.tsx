import { ArrowLeft } from "lucide-react";

import type { Conversation } from "@/lib/api/types";

export function DetailsPanel({
  conversation,
  detailsVisible = true,
  mobileVisible = false,
  onBack,
}: {
  conversation: Conversation | null;
  detailsVisible?: boolean;
  mobileVisible?: boolean;
  onBack?: () => void;
}) {
  const visibilityClass = [
    mobileVisible ? "flex" : "hidden",
    detailsVisible ? "lg:flex" : "lg:hidden",
  ].join(" ");

  const backButton = onBack && (
    <button
      type="button"
      onClick={onBack}
      aria-label="Back to conversation"
      title="Back to conversation"
      className="border-border-default hover:bg-border-subtle mb-1 flex h-8 w-8 flex-none items-center justify-center self-start rounded-full border lg:hidden"
    >
      <ArrowLeft aria-hidden className="h-4 w-4" />
    </button>
  );

  if (!conversation) {
    return (
      <aside
        aria-label="Conversation details"
        className={`border-border-default bg-surface w-full flex-col border-l p-5 lg:w-[280px] lg:shrink-0 ${visibilityClass}`}
      >
        {backButton}
        <p className="text-text-secondary text-[15px]">
          Select a conversation to see its details.
        </p>
      </aside>
    );
  }

  const { contact } = conversation;

  return (
    <aside
      aria-label="Conversation details"
      className={`border-border-default bg-surface w-full flex-col gap-5 overflow-y-auto border-l p-5 lg:w-[280px] lg:shrink-0 ${visibilityClass}`}
    >
      {backButton}
      <div className="flex items-center gap-3">
        {contact.avatarUrl ? (
          <img
            src={contact.avatarUrl}
            alt=""
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div aria-hidden className="h-10 w-10 rounded-full bg-[#e2e8f0]" />
        )}
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold">
            {contact.displayName}
          </p>
          <p className="text-text-secondary text-[14px]">
            {conversation.channel}
          </p>
        </div>
      </div>

      <dl className="flex flex-col gap-3">
        <DetailRow label="LINE user">
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
      <dt className="text-text-secondary shrink-0 text-[14px]">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[15px]">{children}</dd>
    </div>
  );
}

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

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
