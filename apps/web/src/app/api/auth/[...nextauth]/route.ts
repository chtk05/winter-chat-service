import { handlers } from "@/auth";

/**
 * T-026: Auth.js's own route segment. D-042 leaves v5's default `basePath` of `/api/auth`
 * untouched, and the D-040 proxy lives at `/gateway/*` so the two never sit beside each
 * other — which is why no Next.js route-precedence question ever has to be answered here.
 */
export const { GET, POST } = handlers;
