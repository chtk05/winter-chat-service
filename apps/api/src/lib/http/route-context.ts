import { NextResponse, type NextRequest } from "next/server";

import {
  ConfigurationError,
  readAuthConfig,
  type AuthConfig,
} from "@/lib/config";
import { corsHeaders, preflightHeaders } from "@/lib/http/cors";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";

/**
 * Every route in this app needs the same three things before it can do anything: the
 * validated config, the CORS headers for the caller's origin (D-029), and a way to fail
 * when the environment is wrong. Declared once here so the routes stay HTTP-only.
 */
export type RouteContext =
  | {
      readonly ok: true;
      readonly config: AuthConfig;
      readonly cors: Record<string, string>;
    }
  | { readonly ok: false; readonly response: NextResponse };

export function routeContext(
  request: NextRequest,
  routeName: string,
): RouteContext {
  const requestOrigin = request.headers.get("origin");

  try {
    const config = readAuthConfig(process.env);
    return {
      ok: true,
      config,
      cors: corsHeaders(requestOrigin, config.allowedOrigins),
    };
  } catch (error) {
    if (!(error instanceof ConfigurationError)) {
      throw error;
    }

    // Fail loudly in the log, but never echo the message to the caller — it names
    // environment variables and this repo is public (D-001).
    console.error(`[${routeName}] configuration error:`, error.message);

    return {
      ok: false,
      response: errorResponse(
        500,
        ERROR_CODES.serverMisconfigured,
        "The server is not configured correctly.",
        // No allow-list is trustworthy when the config failed to parse, so no CORS
        // headers are emitted.
        corsHeaders(requestOrigin, []),
      ),
    };
  }
}

/**
 * Preflight for the credentialed `fetch` in `apps/web/src/lib/api/client.ts`. A
 * misconfigured server answers without CORS headers, so the browser blocks the real
 * request rather than sending credentials into an unknown state.
 */
export function preflightResponse(request: NextRequest): NextResponse {
  const requestOrigin = request.headers.get("origin");

  let allowedOrigins: readonly string[] = [];
  try {
    allowedOrigins = readAuthConfig(process.env).allowedOrigins;
  } catch {
    allowedOrigins = [];
  }

  return new NextResponse(null, {
    status: 204,
    headers: preflightHeaders(requestOrigin, allowedOrigins),
  });
}
