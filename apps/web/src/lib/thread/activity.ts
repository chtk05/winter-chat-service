import type { ConversationSummary } from "@/lib/api/types";

export interface KnownConversationState {
  unread: boolean;
}

export interface NewActivity {
  id: string;
  displayName: string;
  isNewConversation: boolean;
}

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
