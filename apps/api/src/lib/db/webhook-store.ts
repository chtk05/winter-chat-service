import { Prisma, type PrismaClient } from "@prisma/client";

import type { WebhookStore } from "@/lib/services/webhook";

/**
 * The Prisma-backed `WebhookStore` (T-006). AGENTS.md: `lib/db/**` owns Prisma.
 */
export function createPrismaWebhookStore(prisma: PrismaClient): WebhookStore {
  return {
    async recordEvent(lineEventId: string): Promise<boolean> {
      // D-012: the UNIQUE CONSTRAINT is the dedupe mechanism. Insert and catch, rather
      // than read-then-write — two concurrent redeliveries would both pass a prior read
      // and store the message twice. Here exactly one insert wins.
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
        // Any other failure is a real fault: rethrow so the route answers 500 and LINE
        // retries. Swallowing it would return 200 and lose the message permanently.
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
      // D-048: a contact may hold several. The inbound message lands on the most recent.
      return prisma.conversation.findFirst({
        where: { contactId },
        orderBy: { lastMessageAt: "desc" },
        select: { id: true, status: true },
      });
    },

    async createConversation({ contactId, at }) {
      // D-047: created `Open` on a contact's first inbound message.
      return prisma.conversation.create({
        data: { contactId, status: "Open", unread: true, lastMessageAt: at },
        select: { id: true },
      });
    },

    async appendInboundMessage({
      conversationId,
      messageType,
      text,
      at,
      reopenAsPending,
    }) {
      // One transaction: a message stored without its conversation being marked unread is
      // an invisible message, and the reopen must not be able to land without the message.
      await prisma.$transaction([
        prisma.message.create({
          data: {
            conversationId,
            direction: "inbound",
            messageType,
            text,
            createdAt: at,
            // D-013: inbound messages have no delivery lifecycle.
            deliveryStatus: null,
          },
        }),
        prisma.conversation.update({
          where: { id: conversationId },
          data: {
            unread: true,
            lastMessageAt: at,
            // D-047: `Pending` only on a reopen. An `Open` or `Pending` conversation is
            // left alone — an absent key tells Prisma not to touch the column.
            ...(reopenAsPending ? { status: "Pending" as const } : {}),
          },
        }),
      ]);
    },

    async saveReplyToken({ conversationId, value, issuedAt }) {
      // D-006: tokens are single-use and short-lived. A redelivered event carrying a token
      // already stored is ignored rather than treated as a fault.
      await prisma.replyToken.createMany({
        data: [{ conversationId, value, issuedAt, used: false }],
        skipDuplicates: true,
      });
    },
  };
}
