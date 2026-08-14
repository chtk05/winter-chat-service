import { Prisma, type PrismaClient } from "@prisma/client";

import type { WebhookStore } from "@/lib/services/webhook";

export function createPrismaWebhookStore(prisma: PrismaClient): WebhookStore {
  return {
    async recordEvent(lineEventId: string): Promise<boolean> {
      try {
        await prisma.webhookEvent.create({ data: { lineEventId } });
        return true;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          return false;
        }
        throw error;
      }
    },

    async findContactByLineUserId(lineUserId: string) {
      return prisma.contact.findUnique({
        where: { lineUserId },
        select: { id: true },
      });
    },

    async createContact({ lineUserId, displayName, avatarUrl, firstSeenAt }) {
      return prisma.contact.create({
        data: { lineUserId, displayName, avatarUrl, firstSeenAt },
        select: { id: true },
      });
    },

    async latestConversationForContact(contactId: string) {
      return prisma.conversation.findFirst({
        where: { contactId },
        orderBy: { lastMessageAt: "desc" },
        select: { id: true, status: true },
      });
    },

    async createConversation({ contactId, at }) {
      return prisma.conversation.create({
        data: { contactId, status: "Open", unread: true, lastMessageAt: at },
        select: { id: true },
      });
    },

    async appendInboundMessage({
      conversationId,
      messageType,
      text,
      mediaUrl,
      at,
      reopenAsPending,
    }) {
      await prisma.$transaction([
        prisma.message.create({
          data: {
            conversationId,
            direction: "inbound",
            messageType,
            text,
            mediaUrl,
            createdAt: at,
            deliveryStatus: null,
          },
        }),
        prisma.conversation.update({
          where: { id: conversationId },
          data: {
            unread: true,
            lastMessageAt: at,
            ...(reopenAsPending ? { status: "Pending" as const } : {}),
          },
        }),
      ]);
    },

    async saveReplyToken({ conversationId, value, issuedAt }) {
      await prisma.replyToken.createMany({
        data: [{ conversationId, value, issuedAt, used: false }],
        skipDuplicates: true,
      });
    },
  };
}
