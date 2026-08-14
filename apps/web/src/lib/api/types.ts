/**
 * Types transcribed from `openapi.yaml` (D-021, accepted by D-024).
 *
 * Nothing here may carry a field the contract does not define (§3.2). Where the
 * contract left an `x-pending-decision`, the resolving decision is named.
 */

/** D-019. `openapi.yaml` still carries an OQ-17 marker for the *default*, which is backend scope. */
export type ConversationStatus = "Open" | "Pending" | "Closed";

/** D-013. Outbound only — inbound messages have no delivery status. */
export type DeliveryStatus = "sending" | "sent" | "failed";

export type MessageDirection = "inbound" | "outbound";

/** D-006. Which LINE API delivered it; backs the design's "sent to LINE" badge. */
export type SentVia = "reply" | "push";

export interface Contact {
  id: string;
  /** Shown truncated in the design's details panel ("U8f2c…4471"). */
  lineUserId: string;
  /** D-013 — falls back to the LINE user id when the profile fetch failed. */
  displayName: string;
  avatarUrl?: string | null;
  firstSeenAt: string;
}

export interface ConversationSummary {
  id: string;
  contact: Contact;
  status: ConversationStatus;
  /** D-007 — drives the row's unread dot. */
  unread: boolean;
  unreadCount?: number;
  /** Text of the most recent message. */
  snippet?: string;
  lastMessageAt: string;
  /** Always LINE; the other channels are inert chrome (D-018). */
  channel: "LINE";
}

export interface Conversation extends ConversationSummary {
  messageCount?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  /** Echoes the sender's optimistic id so the bubble can be reconciled (D-021). */
  clientId?: string | null;
  direction: MessageDirection;
  /** LINE message type. `text` is the only supported one (D-010). */
  messageType: string;
  /** Null for non-text inbound placeholders (D-010). */
  text?: string | null;
  deliveryStatus?: DeliveryStatus | null;
  failureReason?: string | null;
  sentVia?: SentVia | null;
  createdAt: string;
}

export interface ConversationListResponse {
  items: ConversationSummary[];
  nextCursor?: string | null;
  /** Backs the design's list footer count line. */
  totals: {
    matching: number;
    all: number;
    open: number;
  };
}

export interface MessagePageResponse {
  items: Message[];
  hasMore: boolean;
  nextCursor?: string | null;
}

/** F-003 metrics only (D-020). */
export interface DashboardSummary {
  range: "today" | "7d";
  generatedAt: string;
  timezone?: "Asia/Bangkok";
  totalContacts: number;
  activeToday: number;
  /** D-027 — the count of contacts holding unread inbound, not of messages. */
  unread: number;
  messages: {
    inbound: number;
    outbound: number;
  };
  /** Seven calendar days, D-014/D-020. */
  series?: Array<{
    date: string;
    inbound: number;
    outbound: number;
  }>;
  recentActivity: Array<{
    conversationId: string;
    contactName: string;
    direction: MessageDirection;
    snippet?: string;
    at: string;
  }>;
}

export interface SessionResponse {
  authenticated: true;
  expiresAt: string;
}

/** The uniform error body D-021 establishes. `ref` backs the design's error card. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    ref?: string;
  };
}
