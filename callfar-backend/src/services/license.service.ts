import { prisma } from '../config/prisma.js';
import { LicenseTier, LicenseStatus } from '@prisma/client';

export class LicenseService {
  /**
   * Get current authenticated user's license and entitlements
   */
  static async getMyLicense(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, license: true },
    });

    if (!user) throw { statusCode: 404, message: 'User not found.' };

    const isMasterAdmin = user.role === 'ADMIN';

    // If no license exists, create default
    if (!user.license) {
      return prisma.userLicense.create({
        data: {
          userId,
          tier: isMasterAdmin ? LicenseTier.MASTER_ADMIN : LicenseTier.FREE,
          status: LicenseStatus.ACTIVE,
          maxCallDurationMinutes: isMasterAdmin ? -1 : 15,
          canVideoCall: true,
          canHdAudio: isMasterAdmin,
          canScreenShare: isMasterAdmin,
          canRecordCalls: isMasterAdmin,
          priorityTurn: isMasterAdmin,
          expiresAt: null,
        },
      });
    }

    // Check expiration if not master admin
    if (!isMasterAdmin && user.license.expiresAt && user.license.expiresAt < new Date()) {
      if (user.license.status !== LicenseStatus.EXPIRED) {
        return prisma.userLicense.update({
          where: { userId },
          data: {
            status: LicenseStatus.EXPIRED,
            tier: LicenseTier.FREE,
            maxCallDurationMinutes: 15,
            canHdAudio: false,
            canScreenShare: false,
            canRecordCalls: false,
            priorityTurn: false,
          },
        });
      }
    }

    return user.license;
  }

  /**
   * Redeem a license activation key
   */
  static async redeemKey(userId: string, keyString: string) {
    const normalizedKey = keyString.trim().toUpperCase();

    const licenseKey = await prisma.licenseKey.findUnique({
      where: { key: normalizedKey },
    });

    if (!licenseKey) {
      throw { statusCode: 404, message: 'Invalid license key. Please check and try again.' };
    }

    if (licenseKey.isRedeemed) {
      throw { statusCode: 400, message: 'This license key has already been redeemed.' };
    }

    const isEnterprise = licenseKey.tier === LicenseTier.ENTERPRISE;
    const isMaster = licenseKey.tier === LicenseTier.MASTER_ADMIN;

    const expiresAt =
      licenseKey.durationDays === -1
        ? null
        : new Date(Date.now() + licenseKey.durationDays * 24 * 60 * 60 * 1000);

    const updatedLicense = await prisma.$transaction(async (tx) => {
      // Mark key as redeemed
      await tx.licenseKey.update({
        where: { id: licenseKey.id },
        data: {
          isRedeemed: true,
          redeemedById: userId,
          redeemedAt: new Date(),
        },
      });

      // Update or create user license
      const license = await tx.userLicense.upsert({
        where: { userId },
        create: {
          userId,
          tier: licenseKey.tier,
          status: LicenseStatus.ACTIVE,
          maxCallDurationMinutes: -1, // Unlimited for redeemed keys
          canVideoCall: true,
          canHdAudio: true,
          canScreenShare: true,
          canRecordCalls: isEnterprise || isMaster,
          priorityTurn: isEnterprise || isMaster,
          expiresAt,
          licenseKey: licenseKey.key,
          issuedBy: licenseKey.createdById,
        },
        update: {
          tier: licenseKey.tier,
          status: LicenseStatus.ACTIVE,
          maxCallDurationMinutes: -1,
          canVideoCall: true,
          canHdAudio: true,
          canScreenShare: true,
          canRecordCalls: isEnterprise || isMaster,
          priorityTurn: isEnterprise || isMaster,
          expiresAt,
          licenseKey: licenseKey.key,
          issuedBy: licenseKey.createdById,
        },
      });

      return license;
    });

    return {
      message: `Congratulations! License successfully upgraded to ${updatedLicense.tier}.`,
      license: updatedLicense,
    };
  }
}
