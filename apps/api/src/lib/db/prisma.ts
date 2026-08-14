import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { systemClock } from "@/lib/clock";
import {
  createPrismaConversationStore,
  createPrismaDashboardStore,
  createPrismaSyncStore,
  createPrismaThreadStore,
} from "@/lib/db/chat-store";
import { createPrismaSendStore } from "@/lib/db/send-store";
import { createPrismaMemberStore } from "@/lib/db/user-store";
import { createPrismaWebhookStore } from "@/lib/db/webhook-store";
import type { MemberStore } from "@/lib/services/auth-service";
import type { ConversationStore } from "@/lib/services/conversations";
import type { DashboardStore } from "@/lib/services/dashboard";
import type { SendStore } from "@/lib/services/send";
import type { SyncStore } from "@/lib/services/sync";
import type { ThreadStore } from "@/lib/services/thread";
import type { WebhookStore } from "@/lib/services/webhook";

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

export function getMemberStore(): MemberStore {
  return createPrismaMemberStore(getPrismaClient().user, () =>
    systemClock.now(),
  );
}

export function getConversationStore(): ConversationStore {
  return createPrismaConversationStore(getPrismaClient());
}

export function getThreadStore(): ThreadStore {
  return createPrismaThreadStore(getPrismaClient());
}

export function getDashboardStore(): DashboardStore {
  return createPrismaDashboardStore(getPrismaClient());
}

export function getWebhookStore(): WebhookStore {
  return createPrismaWebhookStore(getPrismaClient());
}

export function getSendStore(): SendStore {
  return createPrismaSendStore(getPrismaClient());
}

export function getSyncStore(): SyncStore {
  return createPrismaSyncStore(getPrismaClient());
}
