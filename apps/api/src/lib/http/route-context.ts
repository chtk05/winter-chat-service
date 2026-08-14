import { NextResponse } from "next/server";

import {
  ConfigurationError,
  readAuthConfig,
  type AuthConfig,
} from "@/lib/config";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";

/**
 * Every route in this app needs the same two things before it can do anything: the
 * validated config, and a way to fail when the environment is wrong. Declared once here
 * so the routes stay HTTP-only.
 *
 * D-040 removed the CORS half of this module along with `cors.ts` — no browser reaches
 * `apps/api`, so there is no origin to allow-list and no preflight to answer.
 */
/**
 * Named `RouteEnvironment`, not `RouteContext`: Next 16 makes `RouteContext<'/path'>` a
 * global type for the handler's second argument, and two different things called
 * `RouteContext` in the same file is a trap for the next reader.
 */
export type RouteEnvironment =
  | { readonly ok: true; readonly config: AuthConfig }
  | { readonly ok: false; readonly response: NextResponse };

export function routeContext(routeName: string): RouteEnvironment {
  try {
    return { ok: true, config: readAuthConfig(process.env) };
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
      ),
    };
  }
}
