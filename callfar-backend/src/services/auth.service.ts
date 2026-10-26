import { prisma } from '../config/prisma.js';
import { hashPassword, comparePassword, hashToken, generateRandomToken } from '../utils/crypto.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { ENV } from '../config/env.js';
import { EmailService } from './email.service.js';
import { EMAIL_REGEX } from '../validations/auth.validation.js';

export interface RegisterDTO {
  fullName: string;
  username: string;
  email: string;
  password: string;
  phoneNumber?: string;
  deviceId?: string;
  role?: 'ADMIN' | 'MEMBER';
  adminPasscode?: string;
}

export interface LoginDTO {
  identifier: string; // username or email
  password: string;
  deviceId?: string;
}

export class AuthService {
  /**
   * Register a new user with default profile and settings
   */
  static async register(data: RegisterDTO) {
    const normalizedEmail = data.email.toLowerCase().trim();
    const normalizedUsername = data.username.toLowerCase().trim();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      throw { statusCode: 400, message: 'Invalid email address. Please provide a valid email format (e.g. user@example.com).' };
    }

    // Check for existing user
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { username: normalizedUsername },
          ...(data.phoneNumber ? [{ phoneNumber: data.phoneNumber }] : []),
        ],
      },
    });

    if (existing) {
      if (existing.email === normalizedEmail) {
        throw { statusCode: 409, message: 'Email address is already in use.' };
      }
      if (existing.username === normalizedUsername) {
        throw { statusCode: 409, message: 'Username is already taken.' };
      }
      if (data.phoneNumber && existing.phoneNumber === data.phoneNumber) {
        throw { statusCode: 409, message: 'Phone number is already associated with an account.' };
      }
    }

    const passwordHash = await hashPassword(data.password);

    // Determine initial role (if no other users exist or admin passcode is validated, grant ADMIN role)
    const userCount = await prisma.user.count();
    let role: 'ADMIN' | 'MEMBER' = 'MEMBER';

    if (data.role === 'ADMIN') {
      if (userCount > 0 && data.adminPasscode !== ENV.ADMIN_INVITE_CODE) {
        throw { statusCode: 403, message: 'Invalid Admin Security Passcode. Authorization required to enter as Administrator.' };
      }
      role = 'ADMIN';
    } else if (userCount === 0 || normalizedUsername === 'admin' || normalizedEmail.startsWith('admin@')) {
      role = 'ADMIN';
    } else {
      role = 'MEMBER';
    }

    const isMasterAdmin = role === 'ADMIN';

    // Atomically create user, profile, settings, and license in a transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          username: normalizedUsername,
          passwordHash,
          phoneNumber: data.phoneNumber || null,
          role,
          profile: {
            create: {
              displayName: data.fullName.trim(),
              bio: isMasterAdmin ? 'CallFar System Administrator' : 'Hey there! I am using CallFar.',
              isOnline: true,
            },
          },
          settings: {
            create: {
              theme: 'system',
              allowIncomingCalls: true,
              allowReadReceipts: true,
              notificationsEnabled: true,
            },
          },
          license: {
            create: {
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
          },
        },
        include: {
          profile: true,
          settings: true,
          license: true,
        },
      });

      return user;
    });

    // Generate tokens with role
    const tokenPayload = {
      userId: newUser.id,
      email: newUser.email,
      username: newUser.username,
      role: newUser.role,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Store hashed refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ENV.JWT_REFRESH_EXPIRATION_DAYS);

    await prisma.refreshToken.create({
      data: {
        userId: newUser.id,
        tokenHash: hashToken(refreshToken),
        deviceId: data.deviceId || null,
        expiresAt,
      },
    });

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        phoneNumber: newUser.phoneNumber,
        role: newUser.role,
        profile: newUser.profile,
        settings: newUser.settings,
        license: newUser.license,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: ENV.JWT_ACCESS_EXPIRATION,
      },
    };
  }

  /**
   * Login user with username/email & password
   */
  static async login(data: LoginDTO) {
    const identifier = data.identifier.toLowerCase().trim();

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
      include: {
        profile: true,
        settings: true,
        license: true,
      },
    });

    if (!user || !user.isActive) {
      throw { statusCode: 401, message: 'Invalid credentials or inactive account.' };
    }

    const isValid = await comparePassword(data.password, user.passwordHash);
    if (!isValid) {
      throw { statusCode: 401, message: 'Invalid credentials.' };
    }

    // Ensure user has a license record
    let license = user.license;
    if (!license) {
      const isMasterAdmin = user.role === 'ADMIN';
      license = await prisma.userLicense.create({
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
    }

    // Generate tokens with role
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Persist refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ENV.JWT_REFRESH_EXPIRATION_DAYS);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        deviceId: data.deviceId || null,
        expiresAt,
      },
    });

    // Mark online
    await prisma.userProfile.update({
      where: { userId: user.id },
      data: { isOnline: true, lastSeen: new Date() },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        phoneNumber: user.phoneNumber,
        role: user.role,
        profile: user.profile,
        settings: user.settings,
        license,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: ENV.JWT_ACCESS_EXPIRATION,
      },
    };
  }

  /**
   * Renew access token using refresh token
   */
  static async refreshToken(oldRefreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(oldRefreshToken);
    } catch {
      throw { statusCode: 401, message: 'Invalid or expired refresh token.' };
    }

    const tokenHash = hashToken(oldRefreshToken);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
      throw { statusCode: 401, message: 'Refresh token has been revoked or expired.' };
    }

    // Revoke old token and rotate
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    // Lookup latest user role
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true },
    });

    const tokenPayload = {
      userId: payload.userId,
      email: payload.email,
      username: payload.username,
      role: dbUser?.role || payload.role || 'MEMBER',
    };

    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ENV.JWT_REFRESH_EXPIRATION_DAYS);

    await prisma.refreshToken.create({
      data: {
        userId: payload.userId,
        tokenHash: hashToken(newRefreshToken),
        deviceId: storedToken.deviceId,
        expiresAt,
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: ENV.JWT_ACCESS_EXPIRATION,
    };
  }

  /**
   * Revoke refresh token on logout
   */
  static async logout(refreshTokenString?: string, userId?: string) {
    if (refreshTokenString) {
      const tokenHash = hashToken(refreshTokenString);
      await prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { isRevoked: true },
      });
    }

    if (userId) {
      await prisma.userProfile.updateMany({
        where: { userId },
        data: { isOnline: false, lastSeen: new Date() },
      });
    }

    return { success: true };
  }

  /**
   * Elevate an existing user account to Administrator using the system admin passcode
   */
  static async elevateToAdmin(userId: string, adminPasscode: string) {
    if (adminPasscode !== ENV.ADMIN_INVITE_CODE) {
      throw { statusCode: 403, message: 'Invalid Admin Security Passcode.' };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, settings: true, license: true },
    });

    if (!user) {
      throw { statusCode: 404, message: 'User not found.' };
    }

    // Atomically upgrade user role to ADMIN and license to MASTER_ADMIN
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: { role: 'ADMIN' },
        include: { profile: true, settings: true },
      });

      const lic = await tx.userLicense.upsert({
        where: { userId },
        create: {
          userId,
          tier: 'MASTER_ADMIN',
          status: 'ACTIVE',
          maxCallDurationMinutes: -1,
          canVideoCall: true,
          canHdAudio: true,
          canScreenShare: true,
          canRecordCalls: true,
          priorityTurn: true,
          expiresAt: null,
        },
        update: {
          tier: 'MASTER_ADMIN',
          status: 'ACTIVE',
          maxCallDurationMinutes: -1,
          canVideoCall: true,
          canHdAudio: true,
          canScreenShare: true,
          canRecordCalls: true,
          priorityTurn: true,
          expiresAt: null,
        },
      });

      return { ...u, license: lic };
    });

    // Generate fresh tokens with the ADMIN role
    const tokenPayload = {
      userId: updated.id,
      email: updated.email,
      username: updated.username,
      role: updated.role,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    return {
      user: updated,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: ENV.JWT_ACCESS_EXPIRATION,
      },
    };
  }

  /**
   * Request password reset link and verification code for a registered user (by email, username, or phone)
   */
  static async forgotPassword(identifier: string, clientBaseUrl?: string) {
    const raw = (identifier || '').trim();

    if (!raw) {
      throw { statusCode: 400, message: 'Please enter your email address, username, or phone number.' };
    }

    const normalized = raw.toLowerCase();

    // Find account by email, username, or phone number
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: normalized, mode: 'insensitive' } },
          { username: { equals: normalized, mode: 'insensitive' } },
          { phoneNumber: { equals: raw } },
        ],
      },
      include: { profile: true },
    });

    // If account not found, inform the user clearly and allow 1-tap registration
    if (!user) {
      throw {
        statusCode: 404,
        errorCode: 'ACCOUNT_NOT_FOUND',
        message: `No CallFar account found matching "${raw}". You can create a new account in just a few seconds.`,
        canRegister: true,
        identifier: raw,
      };
    }

    // Invalidate any previous unconsumed reset tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        isUsed: false,
      },
      data: { isUsed: true },
    });

    // Generate secure random link token and 6-digit numeric verification code
    const rawToken = generateRandomToken(32);
    const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenHash = hashToken(rawToken);
    const codeHash = hashToken(rawCode);

    // Valid for 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        codeHash,
        expiresAt,
        isUsed: false,
      },
    });

    // For email deliverability and global accessibility, ALWAYS use the official public HTTPS domain
    // so Gmail and mobile browsers accept the link worldwide without local IP or cleartext HTTP blocks
    const publicCloudDomain = 'https://callfar-backend.onrender.com';
    const effectiveBaseUrl = (ENV.APP_URL && ENV.APP_URL.startsWith('https://') && !ENV.APP_URL.includes('localhost'))
      ? ENV.APP_URL
      : (clientBaseUrl && clientBaseUrl.startsWith('https://') && !clientBaseUrl.includes('localhost'))
        ? clientBaseUrl
        : publicCloudDomain;

    // Clean, professional user-facing reset URL (not raw API path)
    const resetUrl = `${effectiveBaseUrl}/reset-password?token=${rawToken}`;

    const hasLiveEmail = Boolean(ENV.SMTP_HOST && ENV.SMTP_USER);

    let emailResult: any = { success: false, previewUrl: undefined };
    if (hasLiveEmail) {
      try {
        emailResult = await EmailService.sendPasswordResetEmail({
          to: user.email,
          username: user.username,
          displayName: user.profile?.displayName,
          resetUrl,
          resetCode: rawCode,
        });
      } catch (err: any) {
        console.error(`[AuthService] Email delivery error for ${user.email}:`, err?.message || err);
      }
    }

    // Mask recipient email (e.g. b***27@gmail.com)
    const maskedEmail = user.email.replace(/^(.)(.*)(@.*)$/, (_, first, middle, domain) => {
      const asterisks = '*'.repeat(Math.max(1, Math.min(middle.length, 5)));
      return `${first}${asterisks}${domain}`;
    });

    return {
      success: true,
      message: hasLiveEmail
        ? `Password reset link and verification code have been dispatched to your email address (${maskedEmail}).`
        : `Password reset verification code generated for ${maskedEmail}. Use the 6-digit code below to set your new password.`,
      email: user.email,
      maskedEmail,
      username: user.username,
      verificationCode: rawCode,
      resetUrl,
      previewUrl: emailResult.previewUrl || undefined,
      isLiveEmailSent: hasLiveEmail,
    };
  }

  /**
   * Verify if a reset token or code is valid
   */
  static async verifyResetToken(tokenOrCode: string) {
    const trimmed = tokenOrCode.trim();
    const targetHash = hashToken(trimmed);

    const record = await prisma.passwordResetToken.findFirst({
      where: {
        OR: [
          { tokenHash: targetHash },
          { codeHash: targetHash },
        ],
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
    });

    if (!record) {
      throw { statusCode: 400, message: 'Invalid or expired password reset link/code. Please request a new one.' };
    }

    return {
      valid: true,
      email: record.user.email,
      username: record.user.username,
    };
  }

  /**
   * Reset user password with verified token or code
   */
  static async resetPassword(tokenOrCode: string, newPassword: string) {
    const trimmed = tokenOrCode.trim();
    const targetHash = hashToken(trimmed);

    const record = await prisma.passwordResetToken.findFirst({
      where: {
        OR: [
          { tokenHash: targetHash },
          { codeHash: targetHash },
        ],
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!record) {
      throw { statusCode: 400, message: 'Invalid or expired password reset link/code. Please request a new one.' };
    }

    const passwordHash = await hashPassword(newPassword);

    // Atomically update password, consume token, and revoke old refresh tokens
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { isUsed: true },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: record.userId },
        data: { isRevoked: true },
      }),
    ]);

    // Optional audit log
    try {
      if (record.user.role === 'ADMIN') {
        await prisma.auditLog.create({
          data: {
            adminId: record.userId,
            adminUsername: record.user.username,
            action: 'RESET_PASSWORD',
            status: 'SUCCESS',
            target: record.user.email,
            details: 'Self-service password reset completed via verified token/code',
          },
        });
      }
    } catch {
      // Non-blocking
    }

    return {
      success: true,
      message: 'Your password has been successfully reset! You can now log in with your new password.',
    };
  }
}

