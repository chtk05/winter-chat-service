import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { systemClock } from "@/lib/clock";
import {
  createPrismaConversationStore,
  createPrismaDashboardStore,
  createPrismaThreadStore,
} from "@/lib/db/chat-store";
import { createPrismaMemberStore } from "@/lib/db/user-store";
import { createPrismaWebhookStore } from "@/lib/db/webhook-store";
import type { MemberStore } from "@/lib/services/auth-service";
import type { ConversationStore } from "@/lib/services/conversations";
import type { DashboardStore } from "@/lib/services/dashboard";
import type { ThreadStore } from "@/lib/services/thread";
import type { WebhookStore } from "@/lib/services/webhook";

/**
 * D-031: the one place a real database client is constructed. Memoized on `globalThis`
 * so Next.js dev-mode hot reload does not open a fresh connection pool on every reload
 * (the standard guard for this pattern, not specific to this app).
 */
const globalForPrisma = globalThis as unknown as {
  prismaClient?: PrismaClient;
};

export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prismaClient) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    const adapter = new PrismaPg({ connectionString });
    globalForPrisma.prismaClient = new PrismaClient({ adapter });
  }
  return globalForPrisma.prismaClient;
}

/** D-046, D-050: the join gate's persistence, bound to the real client. */
export function getMemberStore(): MemberStore {
  return createPrismaMemberStore(getPrismaClient().user, () =>
    systemClock.now(),
  );
}

/** T-013, T-014, T-015: the chat stores, bound to the real client. */
export function getConversationStore(): ConversationStore {
  return createPrismaConversationStore(getPrismaClient());
}

export function getThreadStore(): ThreadStore {
  return createPrismaThreadStore(getPrismaClient());
}

export function getDashboardStore(): DashboardStore {
  return createPrismaDashboardStore(getPrismaClient());
}

/** T-006: the webhook ingest store, bound to the real client. */
export function getWebhookStore(): WebhookStore {
  return createPrismaWebhookStore(getPrismaClient());
}
