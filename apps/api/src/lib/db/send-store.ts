import { Prisma, type PrismaClient } from "@prisma/client";

import type { SendStore } from "@/lib/services/send";

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

export function createPrismaSendStore(prisma: PrismaClient): SendStore {
  return {
    async findConversationForSend(conversationId) {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true, contact: { select: { lineUserId: true } } },
      });

      return conversation
        ? {
            id: conversation.id,
            contactLineUserId: conversation.contact.lineUserId,
          }
        : null;
    },

    async findMessageByClientId(clientId) {
      return prisma.message.findUnique({
        where: { clientId },
        select: messageSelection,
      });
    },

    async createSendingMessage({
      conversationId,
      clientId,
      messageType,
      text,
      mediaUrl,
      createdAt,
    }) {
      try {
        return await prisma.message.create({
          data: {
            conversationId,
            clientId,
            direction: "outbound",
            messageType,
            text,
            mediaUrl,
            deliveryStatus: "sending",
            createdAt,
          },
          select: messageSelection,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const existing = await prisma.message.findUnique({
            where: { clientId },
            select: messageSelection,
          });
          if (existing) {
            return existing;
          }
        }
        throw error;
      }
    },

    async findUnusedReplyToken(conversationId) {
      return prisma.replyToken.findFirst({
        where: { conversationId, used: false },
        orderBy: { issuedAt: "desc" },
        select: { value: true },
      });
    },

    async markReplyTokenUsed(value) {
      await prisma.replyToken.updateMany({
        where: { value },
        data: { used: true },
      });
    },

    async resolveMessage({ id, deliveryStatus, sentVia, failureReason }) {
      return prisma.message.update({
        where: { id },
        data: { deliveryStatus, sentVia, failureReason },
        select: messageSelection,
      });
    },

    async closeConversation(conversationId) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { status: "Closed" },
      });
    },

    async findMessageById(id) {
      return prisma.message.findUnique({
        where: { id },
        select: messageSelection,
      });
    },

    async markMessageSending(id) {
      return prisma.message.update({
        where: { id },
        data: { deliveryStatus: "sending", failureReason: null },
        select: messageSelection,
      });
    },
  };
}
