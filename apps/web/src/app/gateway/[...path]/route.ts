import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import {
  mintServiceToken,
  readApiOrigin,
  readSessionSecret,
} from "@/lib/auth/service-token";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "cookie",
  "authorization",
]);

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const session = await auth();

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
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.arrayBuffer(),
      redirect: "manual",
      cache: "no-store",
    });

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders(response),
    });
  } catch (error) {
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

const CONTENT_CODING_HEADERS = new Set(["content-encoding", "content-length"]);

function responseHeaders(response: Response): Headers {
  const headers = new Headers();

  for (const [name, value] of response.headers) {
    const lowered = name.toLowerCase();

    if (
      lowered !== "set-cookie" &&
      !HOP_BY_HOP.has(lowered) &&
      !CONTENT_CODING_HEADERS.has(lowered)
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
