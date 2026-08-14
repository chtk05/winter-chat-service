import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import {
  mintServiceToken,
  readApiOrigin,
  readSessionSecret,
} from "@/lib/auth/service-token";

/**
 * T-027: the D-040 proxy. Every browser call to the API goes through here, server-side.
 * `apps/api` is never contacted by the browser, so there is no CORS, no cross-site cookie,
 * and `apps/api` need not be publicly reachable except for LINE's webhook.
 *
 * D-042: `/gateway/<path>` maps to `<API_ORIGIN>/api/<path>`. That mapping lives here and
 * nowhere else.
 * D-041: a fresh service token is minted PER CALL and sent as `Authorization: Bearer`.
 * D-021: the upstream status and body are returned unchanged, so the uniform error shape
 * survives the hop.
 */

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  // `host` would name apps/web, not the upstream.
  "host",
  "content-length",
  // THE IMPORTANT ONE: the browser's cookies must never be forwarded. The whole design
  // rests on apps/api trusting one minted token and nothing else. Asserted as a test.
  "cookie",
  // Ours to set, from the minted token — never the caller's to supply.
  "authorization",
]);

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const session = await auth();

  // D-036/D-046: no session at all is refused HERE and never forwarded. A request with no
  // identity has no token to mint and nothing upstream could do with it.
  if (!session?.lineUserId) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in to continue." } },
      { status: 401 },
    );
  }

  const { path } = await context.params;

  let token: string;
  try {
    token = await mintServiceToken(
      { lineUserId: session.lineUserId, member: session.member },
      readSessionSecret(),
    );
  } catch (error) {
    console.error("[gateway] cannot mint service token:", error);
    return NextResponse.json(
      {
        error: {
          code: "SERVER_MISCONFIGURED",
          message: "The server is not configured correctly.",
        },
      },
      { status: 500 },
    );
  }

  const upstream = new URL(`/api/${path.join("/")}`, readApiOrigin());
  // Query strings must survive the hop — the conversation list's filter and search live there.
  upstream.search = request.nextUrl.search;

  const headers = new Headers();
  for (const [name, value] of request.headers) {
    if (!HOP_BY_HOP.has(name.toLowerCase())) {
      headers.set(name, value);
    }
  }
  headers.set("authorization", `Bearer ${token}`);

  try {
    const response = await fetch(upstream, {
      method: request.method,
      headers,
      // GET and HEAD may not carry a body.
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.text(),
      redirect: "manual",
      cache: "no-store",
    });

    // Status and body returned UNCHANGED so D-021's error shape survives (T-027's scope).
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders(response),
    });
  } catch (error) {
    // Upstream unreachable or timed out. 502 rather than a thrown 500, so the console can
    // tell "the API is down" from "this app is broken".
    console.error("[gateway] upstream unreachable:", error);
    return NextResponse.json(
      {
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "The service is temporarily unavailable.",
        },
      },
      { status: 502 },
    );
  }
}

function responseHeaders(response: Response): Headers {
  const headers = new Headers();

  for (const [name, value] of response.headers) {
    // D-039 says apps/api sets no cookies; if one ever appeared, it must not be relayed
    // into the browser where it could collide with Auth.js's own.
    if (
      name.toLowerCase() !== "set-cookie" &&
      !HOP_BY_HOP.has(name.toLowerCase())
    ) {
      headers.set(name, value);
    }
  }

  return headers;
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
