import type {
  ApiErrorBody,
  Conversation,
  ConversationListResponse,
  ConversationStatus,
  DashboardSummary,
  Message,
  MessagePageResponse,
} from "./types";

/**
 * The one place the API path is named.
 *
 * **D-040 + D-042 (2026-08-13): this is now a RELATIVE, SAME-ORIGIN path.** The browser
 * never contacts `apps/api` directly — `apps/web` proxies server-side at `/gateway/*` and
 * attaches the D-041 service token. The proxy maps `/gateway/<path>` to
 * `<API_ORIGIN>/api/<path>`, so D-030's `/api` prefix still applies but lives in the proxy
 * rather than here.
 *
 * This supersedes the previous `NEXT_PUBLIC_API_BASE_URL` origin: shipping the API origin
 * to the client bundle would invite exactly the direct call the design removed.
 */
export const API_BASE_URL = "/gateway";

/** D-026: initial thread load. */
export const INITIAL_MESSAGE_LIMIT = 30;
/** D-026: each "Load full history" page. */
export const MESSAGE_PAGE_LIMIT = 50;

/** An error carrying the D-021 uniform body, so the design's error card can render code + ref. */
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

/** Thrown when the response was not the uniform D-021 shape at all. */
export const UNKNOWN_ERROR_CODE = "UNKNOWN_ERROR";

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    if (body?.error?.code && body.error.message) {
      return new ApiError(response.status, body.error);
    }
  } catch {
    // Body was absent or not JSON — fall through to the generic shape.
  }
  return new ApiError(response.status, {
    code: UNKNOWN_ERROR_CODE,
    message: "Something went wrong. Please try again.",
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    // D-040: same-origin now. Auth.js's cookie keeps its `SameSite=Lax` default — the
    // stronger setting — and is sent to `/gateway/*` because that is this app's own origin.
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

/* ---------------------------------------------------------------- auth --- */

/**
 * D-036's SECOND gate. The caller has already signed in with LINE; this submits the join
 * code. D-039 removed `login` and `logout` from this client entirely — NextAuth owns both
 * in `apps/web`, so they are `signIn`/`signOut` from `@/auth`, not HTTP calls to the API.
 *
 * D-042: reached at `/gateway/auth/join`.
 */
export function joinWorkspace(code: string): Promise<void> {
  return request<void>("/auth/join", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

/* --------------------------------------------------------- conversations --- */

export function listConversations(
  params: {
    status?: ConversationStatus;
    search?: string;
    cursor?: string;
  } = {},
): Promise<ConversationListResponse> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  // The contract treats an empty search string as absent.
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.cursor) query.set("cursor", params.cursor);

  const suffix = query.toString() ? `?${query}` : "";
  return request<ConversationListResponse>(`/conversations${suffix}`);
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

/** D-007 — opening a thread marks all of its inbound messages read. Idempotent. */
export function markRead(conversationId: string): Promise<void> {
  return request<void>(`/conversations/${conversationId}/read`, {
    method: "POST",
  });
}

/* -------------------------------------------------------------- messages --- */

export function listMessages(
  conversationId: string,
  options: { before?: string } = {},
): Promise<MessagePageResponse> {
  const query = new URLSearchParams();
  // D-026: 30 on first load, 50 for each page walked backwards.
  query.set(
    "limit",
    String(options.before ? MESSAGE_PAGE_LIMIT : INITIAL_MESSAGE_LIMIT),
  );
  if (options.before) query.set("before", options.before);

  return request<MessagePageResponse>(
    `/conversations/${conversationId}/messages?${query}`,
  );
}

/**
 * D-021: returns 202 with the message persisted as `sending`. The resolution to
 * `sent`/`failed` arrives over Supabase Realtime (D-005), not in this response.
 */
export function sendMessage(
  conversationId: string,
  body: { text: string; clientId: string; closeAfterSend?: boolean },
): Promise<Message> {
  return request<Message>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** D-013 — only valid from `failed`; 409 otherwise. */
export function retryMessage(messageId: string): Promise<Message> {
  return request<Message>(`/messages/${messageId}/retry`, { method: "POST" });
}

/* ------------------------------------------------------------- dashboard --- */

export function getDashboardSummary(
  range: "today" | "7d" = "today",
): Promise<DashboardSummary> {
  return request<DashboardSummary>(`/dashboard/summary?range=${range}`);
}
