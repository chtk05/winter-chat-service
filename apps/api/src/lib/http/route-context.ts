import { NextResponse } from "next/server";

import {
  ConfigurationError,
  readAuthConfig,
  type AuthConfig,
} from "@/lib/config";
import { ERROR_CODES, errorResponse } from "@/lib/http/errors";

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
