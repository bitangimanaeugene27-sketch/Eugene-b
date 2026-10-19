import { prisma } from '../config/prisma.js';
import { ConversationType, MessageStatus } from '@prisma/client';

export class MessageService {
  /**
   * Get or initialize a direct 1-to-1 conversation between two users
   */
  static async getOrCreateDirectConversation(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw { statusCode: 400, message: 'Cannot create a conversation with yourself.' };
    }

    // Check if a direct conversation already exists between these two users
    const existing = await prisma.conversation.findFirst({
      where: {
        type: ConversationType.DIRECT,
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: targetUserId } } },
        ],
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                profile: { select: { displayName: true, avatarUrl: true, isOnline: true } },
              },
            },
          },
        },
      },
    });

    if (existing) {
      return existing;
    }

    // Create new direct conversation
    const conversation = await prisma.conversation.create({
      data: {
        type: ConversationType.DIRECT,
        members: {
          create: [
            { userId, role: 'ADMIN' },
            { userId: targetUserId, role: 'MEMBER' },
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                profile: { select: { displayName: true, avatarUrl: true, isOnline: true } },
              },
            },
          },
        },
      },
    });

    return conversation;
  }

  /**
   * List all conversations for the user with last message preview and unread count
   */
  static async getUserConversations(userId: string) {
    const memberships = await prisma.conversationMember.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    profile: { select: { displayName: true, avatarUrl: true, isOnline: true, lastSeen: true } },
                  },
                },
              },
            },
            messages: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                senderId: true,
                content: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: { conversation: { updatedAt: 'desc' } },
    });

    return memberships.map((m) => {
      const conv = m.conversation;
      const otherMembers = conv.members.filter((mem) => mem.userId !== userId);
      const peer = otherMembers[0]?.user;

      return {
        id: conv.id,
        type: conv.type,
        title: conv.title || peer?.profile?.displayName || peer?.username || 'Chat',
        peer: peer
          ? {
              id: peer.id,
              username: peer.username,
              displayName: peer.profile?.displayName || peer.username,
              avatarUrl: peer.profile?.avatarUrl,
              isOnline: peer.profile?.isOnline,
              lastSeen: peer.profile?.lastSeen,
            }
          : null,
        lastMessage: conv.messages[0] || null,
        updatedAt: conv.updatedAt,
      };
    });
  }

  /**
   * Get message history with pagination
   */
  static async getMessages(conversationId: string, userId: string, limit = 50, cursor?: string) {
    // Verify membership
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });

    if (!member) {
      throw { statusCode: 403, message: 'You are not a member of this conversation.' };
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    return messages.reverse();
  }

  /**
   * Send a message
   */
  static async sendMessage(conversationId: string, senderId: string, content: string) {
    // Verify membership
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: senderId } },
    });

    if (!member) {
      throw { statusCode: 403, message: 'You are not a member of this conversation.' };
    }

    const message = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversationId,
          senderId,
          content: content.trim(),
          status: MessageStatus.SENT,
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              profile: { select: { displayName: true, avatarUrl: true } },
            },
          },
        },
      });

      // Update conversation timestamp
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      return msg;
    });

    return message;
  }

  /**
   * Mark messages in a conversation as read
   */
  static async markAsRead(conversationId: string, userId: string) {
    await prisma.$transaction(async (tx) => {
      await tx.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadAt: new Date() },
      });

      // Mark messages not sent by this user as READ
      await tx.message.updateMany({
        where: {
          conversationId,
          senderId: { not: userId },
          status: { not: MessageStatus.READ },
        },
        data: { status: MessageStatus.READ },
      });
    });

    return { success: true };
  }
}
