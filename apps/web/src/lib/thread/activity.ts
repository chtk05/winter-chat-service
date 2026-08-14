import type { ConversationSummary } from "@/lib/api/types";

export interface KnownConversationState {
  unread: boolean;
}

export interface NewActivity {
  id: string;
  displayName: string;
  isNewConversation: boolean;
}

/**
 * Pure diff between a poll's previous known-state snapshot and its freshly
 * fetched page — this is what decides which conversations deserve a toast, kept
 * free of `setInterval`/`fetch` so the decision itself is unit testable without
 * fake timers or a network double.
 *
 * A toast fires only for the TRANSITION into unread — a conversation already
 * unread on the last poll must not re-toast every tick, and the conversation
 * currently open must never toast (the admin is already looking at it).
 */
export function detectNewActivity(
  previous: ReadonlyMap<string, KnownConversationState>,
  items: readonly ConversationSummary[],
  activeId: string | null,
): NewActivity[] {
  const activity: NewActivity[] = [];

  for (const item of items) {
    const before = previous.get(item.id);
    const isNewConversation = !before;
    const justArrived = item.unread && (isNewConversation || !before.unread);

    if (justArrived && item.id !== activeId) {
      activity.push({
        id: item.id,
        displayName: item.contact.displayName,
        isNewConversation,
      });
    }
  }

  return activity;
}

export function snapshotConversations(
  items: readonly ConversationSummary[],
): Map<string, KnownConversationState> {
  return new Map(items.map((item) => [item.id, { unread: item.unread }]));
}
