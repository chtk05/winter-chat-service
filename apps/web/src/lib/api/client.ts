import type {
  ApiErrorBody,
  Conversation,
  ConversationListResponse,
  ConversationStatus,
  DashboardSummary,
  InboxSyncResponse,
  Message,
  MessagePageResponse,
} from "./types";

export const API_BASE_URL = "/gateway";

export const INITIAL_MESSAGE_LIMIT = 30;
export const MESSAGE_PAGE_LIMIT = 50;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly ref?: string;

  constructor(status: number, body: ApiErrorBody["error"]) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.ref = body.ref;
  }
}

export const UNKNOWN_ERROR_CODE = "UNKNOWN_ERROR";

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    if (body?.error?.code && body.error.message) {
      return new ApiError(response.status, body.error);
    }
  } catch {}
  return new ApiError(response.status, {
    code: UNKNOWN_ERROR_CODE,
    message: "Something went wrong. Please try again.",
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "same-origin",
    headers:
      init?.body === undefined
        ? undefined
        : { "Content-Type": "application/json" },
    ...init,
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function joinWorkspace(code: string): Promise<void> {
  return request<void>("/auth/join", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function listConversations(
  params: {
    status?: ConversationStatus;
    search?: string;
    cursor?: string;
  } = {},
): Promise<ConversationListResponse> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.cursor) query.set("cursor", params.cursor);

  const suffix = query.toString() ? `?${query}` : "";
  return request<ConversationListResponse>(`/conversations${suffix}`);
}

/** Fetches one conversation directly by id — used to deep-link into a
 * conversation (e.g. from global search) without needing it to already be
 * present in whatever page/filter the inbox list currently has loaded. */
export function getConversation(conversationId: string): Promise<Conversation> {
  return request<Conversation>(`/conversations/${conversationId}`);
}

export function setConversationStatus(
  conversationId: string,
  status: ConversationStatus,
): Promise<Conversation> {
  return request<Conversation>(`/conversations/${conversationId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function markRead(conversationId: string): Promise<void> {
  return request<void>(`/conversations/${conversationId}/read`, {
    method: "POST",
  });
}

export function listMessages(
  conversationId: string,
  options: { before?: string } = {},
): Promise<MessagePageResponse> {
  const query = new URLSearchParams();
  query.set(
    "limit",
    String(options.before ? MESSAGE_PAGE_LIMIT : INITIAL_MESSAGE_LIMIT),
  );
  if (options.before) query.set("before", options.before);

  return request<MessagePageResponse>(
    `/conversations/${conversationId}/messages?${query}`,
  );
}

export function sendMessage(
  conversationId: string,
  body: {
    text?: string;
    mediaUrl?: string;
    clientId: string;
    closeAfterSend?: boolean;
  },
): Promise<Message> {
  return request<Message>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function uploadImage(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch(`${API_BASE_URL}/uploads`, {
    method: "POST",
    credentials: "same-origin",
    body: formData,
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  return (await response.json()) as { url: string };
}

export function retryMessage(messageId: string): Promise<Message> {
  return request<Message>(`/messages/${messageId}/retry`, { method: "POST" });
}

export function getDashboardSummary(
  range: "today" | "7d" = "today",
): Promise<DashboardSummary> {
  return request<DashboardSummary>(`/dashboard/summary?range=${range}`);
}

export const EMPTY_WATERMARK = "1970-01-01T00:00:00.000Z";

export function waitForInboxActivity(
  since?: string | null,
  signal?: AbortSignal,
): Promise<InboxSyncResponse> {
  const query = new URLSearchParams();
  if (since) {
    query.set("since", since);
  }

  const suffix = query.toString() ? `?${query}` : "";
  return request<InboxSyncResponse>(`/sync${suffix}`, { signal });
}
