import { prisma } from '../config/prisma.js';
import { ContactRequestStatus } from '@prisma/client';

export class ContactService {
  /**
   * Get all contacts for a user
   */
  static async getContacts(userId: string) {
    const contacts = await prisma.contact.findMany({
      where: { userId },
      include: {
        contactUser: {
          select: {
            id: true,
            username: true,
            phoneNumber: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
                bio: true,
                isOnline: true,
                lastSeen: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return contacts.map((c) => ({
      id: c.id,
      contactUserId: c.contactUserId,
      aliasName: c.aliasName,
      username: c.contactUser.username,
      displayName: c.aliasName || c.contactUser.profile?.displayName || c.contactUser.username,
      avatarUrl: c.contactUser.profile?.avatarUrl,
      bio: c.contactUser.profile?.bio,
      isOnline: c.contactUser.profile?.isOnline,
      lastSeen: c.contactUser.profile?.lastSeen,
      createdAt: c.createdAt,
    }));
  }

  /**
   * Send a contact request
   */
  static async sendRequest(senderId: string, receiverUsernameOrId: string) {
    const trimmed = receiverUsernameOrId.trim();
    // Only query by UUID if the input actually looks like one, to avoid DB parse errors
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);

    const targetUser = await prisma.user.findFirst({
      where: isUUID
        ? { OR: [{ id: trimmed }, { username: trimmed.toLowerCase() }] }
        : { username: trimmed.toLowerCase() },
    });

    if (!targetUser) {
      throw { statusCode: 404, message: 'User not found.' };
    }

    const receiverId = targetUser.id;

    if (senderId === receiverId) {
      throw { statusCode: 400, message: 'You cannot add yourself as a contact.' };
    }

    // Check if blocked
    const isBlocked = await prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: senderId, blockedId: receiverId },
          { blockerId: receiverId, blockedId: senderId },
        ],
      },
    });

    if (isBlocked) {
      throw { statusCode: 403, message: 'Unable to send contact request.' };
    }

    // Check if already contacts
    const alreadyContact = await prisma.contact.findUnique({
      where: {
        userId_contactUserId: {
          userId: senderId,
          contactUserId: receiverId,
        },
      },
    });

    if (alreadyContact) {
      throw { statusCode: 400, message: 'User is already in your contacts.' };
    }

    // Check if active request exists
    const existingRequest = await prisma.contactRequest.findFirst({
      where: {
        senderId,
        receiverId,
        status: ContactRequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      throw { statusCode: 400, message: 'A contact request is already pending.' };
    }

    // Check if inverse pending request exists (Bob already sent Alice a request)
    const inverseRequest = await prisma.contactRequest.findFirst({
      where: {
        senderId: receiverId,
        receiverId: senderId,
        status: ContactRequestStatus.PENDING,
      },
    });

    if (inverseRequest) {
      // Auto-accept!
      return this.acceptRequest(senderId, inverseRequest.id);
    }

    const request = await prisma.contactRequest.create({
      data: {
        senderId,
        receiverId,
        status: ContactRequestStatus.PENDING,
      },
      include: {
        receiver: {
          select: {
            id: true,
            username: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    return request;
  }

  /**
   * Get pending received and sent contact requests
   */
  static async getPendingRequests(userId: string) {
    const received = await prisma.contactRequest.findMany({
      where: {
        receiverId: userId,
        status: ContactRequestStatus.PENDING,
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
      orderBy: { createdAt: 'desc' },
    });

    const sent = await prisma.contactRequest.findMany({
      where: {
        senderId: userId,
        status: ContactRequestStatus.PENDING,
      },
      include: {
        receiver: {
          select: {
            id: true,
            username: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { received, sent };
  }

  /**
   * Accept contact request
   */
  static async acceptRequest(userId: string, requestId: string) {
    const request = await prisma.contactRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.receiverId !== userId || request.status !== ContactRequestStatus.PENDING) {
      throw { statusCode: 404, message: 'Pending request not found.' };
    }

    // Create mutual contacts atomically in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.contactRequest.update({
        where: { id: requestId },
        data: { status: ContactRequestStatus.ACCEPTED },
      });

      // User -> Sender contact
      await tx.contact.upsert({
        where: {
          userId_contactUserId: {
            userId: request.receiverId,
            contactUserId: request.senderId,
          },
        },
        create: {
          userId: request.receiverId,
          contactUserId: request.senderId,
        },
        update: {},
      });

      // Sender -> User contact
      await tx.contact.upsert({
        where: {
          userId_contactUserId: {
            userId: request.senderId,
            contactUserId: request.receiverId,
          },
        },
        create: {
          userId: request.senderId,
          contactUserId: request.receiverId,
        },
        update: {},
      });
    });

    return { success: true, message: 'Contact request accepted.' };
  }

  /**
   * Reject contact request
   */
  static async rejectRequest(userId: string, requestId: string) {
    const request = await prisma.contactRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.receiverId !== userId) {
      throw { statusCode: 404, message: 'Request not found.' };
    }

    await prisma.contactRequest.update({
      where: { id: requestId },
      data: { status: ContactRequestStatus.REJECTED },
    });

    return { success: true, message: 'Contact request rejected.' };
  }

  /**
   * Remove a contact
   */
  static async removeContact(userId: string, contactUserId: string) {
    await prisma.contact.deleteMany({
      where: {
        userId,
        contactUserId,
      },
    });

    return { success: true, message: 'Contact removed.' };
  }

  /**
   * Block a user
   */
  static async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw { statusCode: 400, message: 'You cannot block yourself.' };
    }

    await prisma.$transaction(async (tx) => {
      // Remove from contacts both ways
      await tx.contact.deleteMany({
        where: {
          OR: [
            { userId: blockerId, contactUserId: blockedId },
            { userId: blockedId, contactUserId: blockerId },
          ],
        },
      });

      // Cancel any pending requests
      await tx.contactRequest.updateMany({
        where: {
          OR: [
            { senderId: blockerId, receiverId: blockedId },
            { senderId: blockedId, receiverId: blockerId },
          ],
          status: ContactRequestStatus.PENDING,
        },
        data: { status: ContactRequestStatus.CANCELLED },
      });

      // Create block entry
      await tx.blockedUser.upsert({
        where: {
          blockerId_blockedId: {
            blockerId,
            blockedId,
          },
        },
        create: {
          blockerId,
          blockedId,
        },
        update: {},
      });
    });

    return { success: true, message: 'User blocked.' };
  }

  /**
   * Unblock a user
   */
  static async unblockUser(blockerId: string, blockedId: string) {
    await prisma.blockedUser.deleteMany({
      where: {
        blockerId,
        blockedId,
      },
    });

    return { success: true, message: 'User unblocked.' };
  }

  /**
   * Get blocked users list
   */
  static async getBlockedUsers(userId: string) {
    const list = await prisma.blockedUser.findMany({
      where: { blockerId: userId },
      include: {
        blocked: {
          select: {
            id: true,
            username: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    return list.map((b) => ({
      id: b.id,
      blockedId: b.blockedId,
      username: b.blocked.username,
      displayName: b.blocked.profile?.displayName,
      avatarUrl: b.blocked.profile?.avatarUrl,
      blockedAt: b.createdAt,
    }));
  }
}
