import {
  detectNewActivity,
  snapshotConversations,
} from "@/lib/thread/activity";
import type { ConversationStatus, ConversationSummary } from "@/lib/api/types";

function conversation(
  id: string,
  overrides: Partial<ConversationSummary> = {},
): ConversationSummary {
  return {
    id,
    contact: {
      id: `contact-${id}`,
      lineUserId: `U${id}0000000000000000000000000000`,
      displayName: "Ploy Sirichai",
      firstSeenAt: "2026-08-04T13:58:00+07:00",
    },
    status: "Open" as ConversationStatus,
    unread: false,
    snippet: "Is the walnut desk lamp back in stock?",
    lastMessageAt: "2026-08-12T09:41:00+07:00",
    channel: "LINE",
    ...overrides,
  };
}

describe("detectNewActivity", () => {
  it("flags a brand-new unread conversation as a new conversation", () => {
    const activity = detectNewActivity(
      new Map(),
      [conversation("c1", { unread: true })],
      null,
    );

    expect(activity).toEqual([
      { id: "c1", displayName: "Ploy Sirichai", isNewConversation: true },
    ]);
  });

  it("flags an EXISTING conversation transitioning into unread as a new message", () => {
    const previous = snapshotConversations([
      conversation("c1", { unread: false }),
    ]);

    const activity = detectNewActivity(
      previous,
      [conversation("c1", { unread: true })],
      null,
    );

    expect(activity).toEqual([
      { id: "c1", displayName: "Ploy Sirichai", isNewConversation: false },
    ]);
  });

  it("does NOT re-flag a conversation that was already unread on the last poll", () => {
    const previous = snapshotConversations([
      conversation("c1", { unread: true }),
    ]);

    const activity = detectNewActivity(
      previous,
      [conversation("c1", { unread: true })],
      null,
    );

    expect(activity).toEqual([]);
  });

  it("does NOT flag a brand-new conversation that arrives already read", () => {
    const activity = detectNewActivity(
      new Map(),
      [conversation("c1", { unread: false })],
      null,
    );

    expect(activity).toEqual([]);
  });

  it("does NOT flag the conversation the admin currently has open", () => {
    const activity = detectNewActivity(
      new Map(),
      [conversation("c1", { unread: true })],
      "c1",
    );

    expect(activity).toEqual([]);
  });

  it("flags multiple conversations independently", () => {
    const previous = snapshotConversations([
      conversation("c1", { unread: true }),
    ]);

    const activity = detectNewActivity(
      previous,
      [
        conversation("c1", { unread: true }), // unchanged, already unread
        conversation("c2", {
          unread: true,
          contact: {
            id: "contact-c2",
            lineUserId: "U000000000000000000000000000c2",
            displayName: "Nattapong",
            firstSeenAt: "2026-08-13T10:00:00+07:00",
          },
        }), // brand new
      ],
      null,
    );

    expect(activity).toEqual([
      { id: "c2", displayName: "Nattapong", isNewConversation: true },
    ]);
  });
});

describe("snapshotConversations", () => {
  it("captures each conversation's unread state, keyed by id", () => {
    const snapshot = snapshotConversations([
      conversation("c1", { unread: true }),
      conversation("c2", { unread: false }),
    ]);

    expect(snapshot.get("c1")).toEqual({ unread: true });
    expect(snapshot.get("c2")).toEqual({ unread: false });
  });
});
