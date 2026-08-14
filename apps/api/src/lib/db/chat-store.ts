import type { PrismaClient } from "@prisma/client";

import type { ConversationStatus } from "@/lib/services/chat-types";
import type {
  ConversationListRow,
  ConversationStore,
} from "@/lib/services/conversations";
import type { DashboardStore } from "@/lib/services/dashboard";
import type { SyncStore } from "@/lib/services/sync";
import type { ThreadStore } from "@/lib/services/thread";

const conversationSelection = {
  id: true,
  status: true,
  unread: true,
  lastMessageAt: true,
  contact: {
    select: {
      id: true,
      lineUserId: true,
      displayName: true,
      avatarUrl: true,
      firstSeenAt: true,
    },
  },
} as const;

const messageSelection = {
  id: true,
  conversationId: true,
  clientId: true,
  direction: true,
  messageType: true,
  text: true,
  mediaUrl: true,
  deliveryStatus: true,
  failureReason: true,
  sentVia: true,
  createdAt: true,
} as const;

export function createPrismaThreadStore(prisma: PrismaClient): ThreadStore {
  return {
    async conversationExists(conversationId) {
      const found = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true },
      });
      return found !== null;
    },

    async listMessagesDescending({ conversationId, before, take }) {
      const cursor = before
        ? await prisma.message.findUnique({
            where: { id: before },
            select: { createdAt: true },
          })
        : null;

      return prisma.message.findMany({
        where: {
          conversationId,
          ...(cursor ? { createdAt: { lt: cursor.createdAt } } : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take,
        select: messageSelection,
      });
    },
  };
}

export function createPrismaConversationStore(
  prisma: PrismaClient,
): ConversationStore {
  function whereFilter(args: { status?: ConversationStatus; search?: string }) {
    return {
      ...(args.status ? { status: args.status } : {}),
      ...(args.search
        ? {
            OR: [
              {
                contact: {
                  displayName: {
                    contains: args.search,
                    mode: "insensitive" as const,
                  },
                },
              },
              {
                messages: {
                  some: {
                    text: {
                      contains: args.search,
                      mode: "insensitive" as const,
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
  }

  async function snippetFor(
    conversationId: string,
  ): Promise<string | undefined> {
    const latest = await prisma.message.findFirst({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      select: { text: true },
    });

    return latest?.text ?? undefined;
  }

  return {
    async listLatestPerContact({ status, search, cursor, take }) {
      const cursorRow = cursor
        ? await prisma.conversation.findUnique({
            where: { id: cursor },
            select: { lastMessageAt: true },
          })
        : null;

      const rows = await prisma.conversation.findMany({
        where: {
          ...whereFilter({ status, search }),
          ...(cursorRow
            ? { lastMessageAt: { lt: cursorRow.lastMessageAt } }
            : {}),
        },
        orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
        distinct: ["contactId"],
        take,
        select: conversationSelection,
      });

      return Promise.all(
        rows.map(async (conversation): Promise<ConversationListRow> => ({
          conversation,
          snippet: await snippetFor(conversation.id),
        })),
      );
    },

    async countTotals({ status, search }) {
      const [matching, all, open] = await Promise.all([
        countContacts(whereFilter({ status, search })),
        countContacts({}),
        countContacts({ status: "Open" }),
      ]);

      return { matching, all, open };
    },

    async findById(conversationId) {
      return prisma.conversation.findUnique({
        where: { id: conversationId },
        select: conversationSelection,
      });
    },

    async countMessages(conversationId) {
      return prisma.message.count({ where: { conversationId } });
    },

    latestSnippet: snippetFor,

    async updateStatus(conversationId, status) {
      const existing = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true },
      });

      if (!existing) {
        return null;
      }

      return prisma.conversation.update({
        where: { id: conversationId },
        data: { status },
        select: conversationSelection,
      });
    },

    async markRead(conversationId) {
      const { count } = await prisma.conversation.updateMany({
        where: { id: conversationId },
        data: { unread: false },
      });

      return count > 0;
    },
  };

  async function countContacts(where: object): Promise<number> {
    const groups = await prisma.conversation.findMany({
      where,
      distinct: ["contactId"],
      select: { contactId: true },
    });

    return groups.length;
  }
}

export function createPrismaDashboardStore(
  prisma: PrismaClient,
): DashboardStore {
  return {
    async countContacts() {
      return prisma.contact.count();
    },

    async countUnreadContacts() {
      const rows = await prisma.conversation.findMany({
        where: { unread: true },
        distinct: ["contactId"],
        select: { contactId: true },
      });

      return rows.length;
    },

    async countActiveContactsSince(since) {
      const rows = await prisma.conversation.findMany({
        where: { messages: { some: { createdAt: { gte: since } } } },
        distinct: ["contactId"],
        select: { contactId: true },
      });

      return rows.length;
    },

    async listMessagesSince(since) {
      return prisma.message.findMany({
        where: { createdAt: { gte: since } },
        select: { direction: true, createdAt: true },
      });
    },

    async listRecentActivity(take) {
      const rows = await prisma.message.findMany({
        orderBy: { createdAt: "desc" },
        take,
        select: {
          conversationId: true,
          direction: true,
          text: true,
          createdAt: true,
          conversation: {
            select: {
              contact: { select: { displayName: true, lineUserId: true } },
            },
          },
        },
      });

      return rows.map((row) => ({
        conversationId: row.conversationId,
        contactName:
          row.conversation.contact.displayName ??
          row.conversation.contact.lineUserId,
        direction: row.direction,
        ...(row.text === null ? {} : { snippet: row.text }),
        at: row.createdAt,
      }));
    },
  };
}

export function createPrismaSyncStore(prisma: PrismaClient): SyncStore {
  return {
    async latestActivityAt() {
      const row = await prisma.conversation.findFirst({
        orderBy: { lastMessageAt: "desc" },
        select: { lastMessageAt: true },
      });

      return row?.lastMessageAt ?? null;
    },
  };
}
