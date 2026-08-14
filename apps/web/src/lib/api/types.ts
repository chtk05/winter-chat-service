export type ConversationStatus = "Open" | "Pending" | "Closed";

export type DeliveryStatus = "sending" | "sent" | "failed";

export type MessageDirection = "inbound" | "outbound";

export type SentVia = "reply" | "push";

export interface Contact {
  id: string;
  lineUserId: string;
  displayName: string;
  avatarUrl?: string | null;
  firstSeenAt: string;
}

export interface ConversationSummary {
  id: string;
  contact: Contact;
  status: ConversationStatus;
  unread: boolean;
  unreadCount?: number;
  snippet?: string;
  lastMessageAt: string;
  channel: "LINE";
}

export interface Conversation extends ConversationSummary {
  messageCount?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  clientId?: string | null;
  direction: MessageDirection;
  messageType: string;
  text?: string | null;
  mediaUrl?: string | null;
  deliveryStatus?: DeliveryStatus | null;
  failureReason?: string | null;
  sentVia?: SentVia | null;
  createdAt: string;
}

export interface ConversationListResponse {
  items: ConversationSummary[];
  nextCursor?: string | null;
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

export interface DashboardSummary {
  range: "today" | "7d";
  generatedAt: string;
  timezone?: "Asia/Bangkok";
  totalContacts: number;
  activeToday: number;
  unread: number;
  messages: {
    inbound: number;
    outbound: number;
  };
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

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    ref?: string;
  };
}
