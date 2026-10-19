import { prisma } from '../config/prisma.js';
import { comparePassword, hashPassword } from '../utils/crypto.js';
import { NetworkService } from './network.service.js';

export class UserService {
  static async getProfile(userId: string) {
    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        phoneNumber: true,
        role: true,
        isActive: true,
        createdAt: true,
        profile: true,
        settings: true,
        license: true,
      },
    });

    if (!user) {
      throw { statusCode: 404, message: 'User not found.' };
    }

    // Automatically create license if missing (legacy support)
    if (!user.license) {
      const isMasterAdmin = user.role === 'ADMIN';
      const createdLicense = await prisma.userLicense.create({
        data: {
          userId: user.id,
          tier: isMasterAdmin ? 'MASTER_ADMIN' : 'FREE',
          status: 'ACTIVE',
          maxCallDurationMinutes: isMasterAdmin ? -1 : 15,
          canVideoCall: true,
          canHdAudio: isMasterAdmin,
          canScreenShare: isMasterAdmin,
          canRecordCalls: isMasterAdmin,
          priorityTurn: isMasterAdmin,
          expiresAt: null,
        },
      });
      user = { ...user, license: createdLicense };
    }

    return user;
  }

  static async updateProfile(
    userId: string,
    data: { displayName?: string; bio?: string; avatarUrl?: string | null; isOnline?: boolean; phoneNumber?: string }
  ) {
    if (data.phoneNumber !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: { phoneNumber: data.phoneNumber.trim() || null },
      });
    }

    const profileData: any = {};
    if (data.displayName !== undefined) profileData.displayName = data.displayName;
    if (data.bio !== undefined) profileData.bio = data.bio;
    if (data.avatarUrl !== undefined) profileData.avatarUrl = data.avatarUrl;
    if (data.isOnline !== undefined) profileData.isOnline = data.isOnline;

    if (Object.keys(profileData).length > 0) {
      await prisma.userProfile.update({
        where: { userId },
        data: profileData,
      });
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        phoneNumber: true,
        role: true,
        isActive: true,
        createdAt: true,
        profile: true,
        settings: true,
        license: true,
      },
    });

    return fullUser;
  }

  static async updateSettings(
    userId: string,
    data: {
      theme?: string;
      allowIncomingCalls?: boolean;
      allowReadReceipts?: boolean;
      callRingtone?: string;
      notificationsEnabled?: boolean;
    }
  ) {
    const updated = await prisma.userSettings.update({
      where: { userId },
      data,
    });

    return updated;
  }

  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw { statusCode: 404, message: 'User not found.' };

    const isValid = await comparePassword(currentPassword, user.passwordHash);
    if (!isValid) throw { statusCode: 401, message: 'Current password is incorrect.' };

    if (newPassword.length < 8) throw { statusCode: 400, message: 'New password must be at least 8 characters.' };
    if (!/[A-Z]/.test(newPassword)) throw { statusCode: 400, message: 'New password must contain at least one uppercase letter.' };
    if (!/[0-9]/.test(newPassword)) throw { statusCode: 400, message: 'New password must contain at least one number.' };

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    // Revoke all refresh tokens to force re-login on other devices
    await prisma.refreshToken.updateMany({ where: { userId }, data: { isRevoked: true } });
    return { success: true };
  }

  static async deleteAccount(userId: string, password: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw { statusCode: 404, message: 'User not found.' };

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) throw { statusCode: 401, message: 'Incorrect password. Account not deleted.' };

    // Soft-delete: deactivate account and anonymise profile
    await prisma.$transaction(async (tx) => {
      await tx.userProfile.update({
        where: { userId },
        data: { displayName: 'Deleted User', avatarUrl: null, bio: null, isOnline: false },
      });
      await tx.refreshToken.updateMany({ where: { userId }, data: { isRevoked: true } });
      await tx.user.update({ where: { id: userId }, data: { isActive: false } });
    });
    return { success: true };
  }

  static async searchUsers(query: string, currentUserId: string) {
    const cleanQuery = query.trim().toLowerCase();

    // If query is empty, return suggested/discoverable users for new users
    if (!cleanQuery) {
      const suggested = await prisma.user.findMany({
        where: {
          AND: [
            { id: { not: currentUserId } },
            { isActive: true },
            {
              blockedBy: { none: { blockerId: currentUserId } },
            },
            {
              blockedUsers: { none: { blockedId: currentUserId } },
            },
          ],
        },
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
        orderBy: [
          { profile: { isOnline: 'desc' } },
          { createdAt: 'desc' },
        ],
        take: 20,
      });

      return suggested.map((u) => ({
        ...u,
        isSameNetwork: NetworkService.isSameNetwork(currentUserId, u.id),
        networkMode: NetworkService.isSameNetwork(currentUserId, u.id)
          ? 'SAME_NETWORK_LAN'
          : 'REMOTE_NETWORK_WAN',
      }));
    }

    // Search users by matching username, display name, email, or exact phone number
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUserId } },
          { isActive: true },
          {
            OR: [
              { username: { contains: cleanQuery, mode: 'insensitive' } },
              { email: { contains: cleanQuery, mode: 'insensitive' } },
              { phoneNumber: cleanQuery },
              { profile: { displayName: { contains: cleanQuery, mode: 'insensitive' } } },
            ],
          },
          // Ensure not blocked by searcher or blocker
          {
            blockedBy: {
              none: { blockerId: currentUserId },
            },
          },
          {
            blockedUsers: {
              none: { blockedId: currentUserId },
            },
          },
        ],
      },
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
      take: 25,
    });

    return users.map((u) => ({
      ...u,
      isSameNetwork: NetworkService.isSameNetwork(currentUserId, u.id),
      networkMode: NetworkService.isSameNetwork(currentUserId, u.id)
        ? 'SAME_NETWORK_LAN'
        : 'REMOTE_NETWORK_WAN',
    }));
  }
}
