/**
 * D-029: `apps/api` is a second origin (D-025), so the session cookie is cross-origin
 * and every credentialed request needs CORS headers.
 *
 * `Access-Control-Allow-Origin: *` is invalid with `Access-Control-Allow-Credentials`,
 * and echoing an unvalidated `Origin` would let any site on the internet ride a
 * reviewer's session. So the request origin is matched against an exact allow-list and
 * echoed only on a hit; a miss gets no CORS headers at all and the browser blocks the
 * response itself.
 */
export function resolveAllowedOrigin(
  requestOrigin: string | null,
  allowedOrigins: readonly string[],
): string | null {
  if (!requestOrigin) {
    return null;
  }

  return allowedOrigins.includes(requestOrigin) ? requestOrigin : null;
}

/**
 * `Vary: Origin` is emitted whether or not the origin matched: the response body differs
 * by origin, so a cache that ignored it could serve an allowed origin's headers to a
 * disallowed one.
 */
export function corsHeaders(
  requestOrigin: string | null,
  allowedOrigins: readonly string[],
): Record<string, string> {
  const allowedOrigin = resolveAllowedOrigin(requestOrigin, allowedOrigins);

  if (!allowedOrigin) {
    return { Vary: "Origin" };
  }

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

/** Preflight for the credentialed `fetch` in `apps/web/src/lib/api/client.ts`. */
export function preflightHeaders(
  requestOrigin: string | null,
  allowedOrigins: readonly string[],
): Record<string, string> {
  const headers = corsHeaders(requestOrigin, allowedOrigins);

  if (!("Access-Control-Allow-Origin" in headers)) {
    return headers;
  }

  return {
    ...headers,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}
