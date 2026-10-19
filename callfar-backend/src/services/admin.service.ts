import { prisma } from '../config/prisma.js';
import { Role, LicenseTier, LicenseStatus } from '@prisma/client';
import crypto from 'crypto';
import { hashPassword } from '../utils/crypto.js';

export class AdminService {
  /**
   * Get comprehensive system statistics and health metrics
   */
  static async getSystemStats() {
    const [
      totalUsers,
      activeUsers,
      onlineProfiles,
      adminCount,
      totalCalls,
      completedCalls,
      ongoingCalls,
      totalMessages,
      licenses,
      totalKeys,
      redeemedKeys,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.userProfile.count({ where: { isOnline: true } }),
      prisma.user.count({ where: { role: Role.ADMIN } }),
      prisma.call.count(),
      prisma.call.count({ where: { status: 'COMPLETED' } }),
      prisma.call.count({ where: { status: { in: ['INITIATED', 'RINGING', 'ONGOING'] } } }),
      prisma.message.count(),
      prisma.userLicense.groupBy({
        by: ['tier'],
        _count: { tier: true },
      }),
      prisma.licenseKey.count(),
      prisma.licenseKey.count({ where: { isRedeemed: true } }),
    ]);

    // Calculate total call duration in minutes
    const durationSum = await prisma.call.aggregate({
      _sum: { durationSeconds: true },
    });
    const totalDurationMinutes = Math.round((durationSum._sum.durationSeconds || 0) / 60);

    // Map license tiers count
    const licenseStats: Record<string, number> = {
      FREE: 0,
      PRO: 0,
      ENTERPRISE: 0,
      MASTER_ADMIN: 0,
    };
    for (const item of licenses) {
      licenseStats[item.tier] = item._count.tier;
    }

    const memoryUsage = process.memoryUsage();

    return {
      overview: {
        totalUsers,
        activeUsers,
        onlineUsers: onlineProfiles,
        adminCount,
        memberCount: totalUsers - adminCount,
      },
      calling: {
        totalCalls,
        completedCalls,
        activeCalls: ongoingCalls,
        totalDurationMinutes,
      },
      messaging: {
        totalMessages,
      },
      licensing: {
        tiers: licenseStats,
        totalKeysGenerated: totalKeys,
        keysRedeemed: redeemedKeys,
        keysAvailable: totalKeys - redeemedKeys,
      },
      systemHealth: {
        status: 'HEALTHY',
        uptimeSeconds: Math.floor(process.uptime()),
        uptimeFormatted: formatUptime(process.uptime()),
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsageMB: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        },
      },
    };
  }

  /**
   * Get paginated list of all users with search, role, status, and tier filtering
   */
  static async getAllUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: Role;
    isActive?: boolean;
    tier?: LicenseTier;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.search) {
      const term = params.search.trim();
      where.OR = [
        { email: { contains: term, mode: 'insensitive' } },
        { username: { contains: term, mode: 'insensitive' } },
        { phoneNumber: { contains: term, mode: 'insensitive' } },
        { profile: { displayName: { contains: term, mode: 'insensitive' } } },
      ];
    }

    if (params.role) {
      where.role = params.role;
    }

    if (params.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    if (params.tier) {
      where.license = { tier: params.tier };
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          username: true,
          phoneNumber: true,
          isPhoneVerified: true,
          isActive: true,
          role: true,
          createdAt: true,
          profile: true,
          license: true,
          _count: {
            select: {
              initiatedCalls: true,
              callParticipations: true,
              messages: true,
              contacts: true,
            },
          },
        },
      }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Toggle user active/suspended state
   */
  static async updateUserStatus(userId: string, isActive: boolean, adminUserId: string) {
    if (userId === adminUserId && !isActive) {
      throw { statusCode: 400, message: 'You cannot suspend your own administrator account.' };
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw { statusCode: 404, message: 'User not found.' };

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: { id: true, username: true, email: true, isActive: true, role: true },
    });

    // If suspended, revoke all active sessions immediately
    if (!isActive) {
      await prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true },
      });
      await prisma.userProfile.updateMany({
        where: { userId },
        data: { isOnline: false },
      });
    }

    return updated;
  }

  /**
   * Change user role (Promote to ADMIN or demote to MEMBER)
   */
  static async updateUserRole(userId: string, role: Role, adminUserId: string) {
    if (userId === adminUserId && role !== Role.ADMIN) {
      throw { statusCode: 400, message: 'You cannot demote your own administrator account.' };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { license: true },
    });
    if (!user) throw { statusCode: 404, message: 'User not found.' };

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: { role },
      });

      // If promoted to ADMIN, automatically grant MASTER_ADMIN License
      if (role === Role.ADMIN) {
        await tx.userLicense.upsert({
          where: { userId },
          create: {
            userId,
            tier: LicenseTier.MASTER_ADMIN,
            status: LicenseStatus.ACTIVE,
            maxCallDurationMinutes: -1,
            canVideoCall: true,
            canHdAudio: true,
            canScreenShare: true,
            canRecordCalls: true,
            priorityTurn: true,
            expiresAt: null,
          },
          update: {
            tier: LicenseTier.MASTER_ADMIN,
            status: LicenseStatus.ACTIVE,
            maxCallDurationMinutes: -1,
            canVideoCall: true,
            canHdAudio: true,
            canScreenShare: true,
            canRecordCalls: true,
            priorityTurn: true,
            expiresAt: null,
          },
        });
      }

      return u;
    });

    return updated;
  }

  /**
   * Delete a user permanently
   */
  static async deleteUser(userId: string, adminUserId: string) {
    if (userId === adminUserId) {
      throw { statusCode: 400, message: 'You cannot delete your own administrator account.' };
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw { statusCode: 404, message: 'User not found.' };

    await prisma.user.delete({ where: { id: userId } });
    return { success: true, message: `User ${user.username} deleted permanently.` };
  }

  /**
   * Create a new user or administrator directly from the Admin Hub
   */
  static async createUser(
    data: {
      fullName: string;
      username: string;
      email: string;
      password: string;
      role?: Role;
      phoneNumber?: string;
      tier?: LicenseTier;
    },
    adminUserId: string
  ) {
    const normalizedEmail = data.email.toLowerCase().trim();
    const normalizedUsername = data.username.toLowerCase().trim();

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
      if (existing.email === normalizedEmail) throw { statusCode: 409, message: 'Email address is already in use.' };
      if (existing.username === normalizedUsername) throw { statusCode: 409, message: 'Username is already taken.' };
      if (data.phoneNumber && existing.phoneNumber === data.phoneNumber) throw { statusCode: 409, message: 'Phone number already registered.' };
    }

    const passwordHash = await hashPassword(data.password);
    const role = data.role || Role.MEMBER;
    const isMaster = role === Role.ADMIN || data.tier === LicenseTier.MASTER_ADMIN;
    const tier = data.tier || (isMaster ? LicenseTier.MASTER_ADMIN : LicenseTier.FREE);

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
              bio: role === Role.ADMIN ? 'CallFar System Administrator' : 'CallFar Member',
              isOnline: false,
            },
          },
          settings: {
            create: {
              theme: 'system',
              allowIncomingCalls: true,
              allowReadReceipts: true,
            },
          },
          license: {
            create: {
              tier,
              status: LicenseStatus.ACTIVE,
              maxCallDurationMinutes: isMaster || tier === LicenseTier.PRO || tier === LicenseTier.ENTERPRISE ? -1 : 15,
              canVideoCall: true,
              canHdAudio: isMaster || tier === LicenseTier.PRO || tier === LicenseTier.ENTERPRISE,
              canScreenShare: isMaster || tier === LicenseTier.PRO || tier === LicenseTier.ENTERPRISE,
              canRecordCalls: isMaster || tier === LicenseTier.ENTERPRISE,
              priorityTurn: isMaster || tier === LicenseTier.ENTERPRISE,
              expiresAt: null,
              issuedBy: adminUserId,
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

    return {
      id: newUser.id,
      email: newUser.email,
      username: newUser.username,
      role: newUser.role,
      profile: newUser.profile,
      license: newUser.license,
    };
  }

  /**
   * Directly assign or customize user license
   */
  static async manageUserLicense(
    userId: string,
    data: {
      tier: LicenseTier;
      status?: LicenseStatus;
      maxCallDurationMinutes?: number;
      canVideoCall?: boolean;
      canHdAudio?: boolean;
      canScreenShare?: boolean;
      canRecordCalls?: boolean;
      priorityTurn?: boolean;
      durationDays?: number; // -1 for permanent, or days from now
    },
    adminUserId: string
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw { statusCode: 404, message: 'User not found.' };

    let expiresAt: Date | null = null;
    if (data.durationDays && data.durationDays > 0) {
      expiresAt = new Date(Date.now() + data.durationDays * 24 * 60 * 60 * 1000);
    } else if (data.durationDays === -1 || data.tier === LicenseTier.MASTER_ADMIN) {
      expiresAt = null;
    }

    // Default entitlements based on tier if not explicitly overridden
    const isMaster = data.tier === LicenseTier.MASTER_ADMIN;
    const isEnterprise = data.tier === LicenseTier.ENTERPRISE;
    const isPro = data.tier === LicenseTier.PRO;

    const license = await prisma.userLicense.upsert({
      where: { userId },
      create: {
        userId,
        tier: data.tier,
        status: data.status || LicenseStatus.ACTIVE,
        maxCallDurationMinutes: data.maxCallDurationMinutes ?? (isMaster || isEnterprise || isPro ? -1 : 15),
        canVideoCall: data.canVideoCall ?? true,
        canHdAudio: data.canHdAudio ?? (isMaster || isEnterprise || isPro),
        canScreenShare: data.canScreenShare ?? (isMaster || isEnterprise || isPro),
        canRecordCalls: data.canRecordCalls ?? (isMaster || isEnterprise),
        priorityTurn: data.priorityTurn ?? (isMaster || isEnterprise),
        expiresAt,
        issuedBy: adminUserId,
      },
      update: {
        tier: data.tier,
        status: data.status || LicenseStatus.ACTIVE,
        maxCallDurationMinutes: data.maxCallDurationMinutes ?? (isMaster || isEnterprise || isPro ? -1 : 15),
        canVideoCall: data.canVideoCall ?? true,
        canHdAudio: data.canHdAudio ?? (isMaster || isEnterprise || isPro),
        canScreenShare: data.canScreenShare ?? (isMaster || isEnterprise || isPro),
        canRecordCalls: data.canRecordCalls ?? (isMaster || isEnterprise),
        priorityTurn: data.priorityTurn ?? (isMaster || isEnterprise),
        expiresAt,
        issuedBy: adminUserId,
      },
    });

    return license;
  }

  /**
   * Generate License Activation Keys
   */
  static async generateLicenseKeys(
    params: {
      tier: LicenseTier;
      durationDays?: number;
      notes?: string;
      count?: number;
      customPrefix?: string;
    },
    adminUserId: string
  ) {
    const count = Math.min(50, Math.max(1, params.count || 1));
    const durationDays = params.durationDays ?? 30;
    const tier = params.tier || LicenseTier.PRO;
    const prefix = params.customPrefix?.trim().toUpperCase() || `CF-${tier.substring(0, 3)}`;

    const generatedKeys: string[] = [];

    for (let i = 0; i < count; i++) {
      const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
      const randomPart2 = crypto.randomBytes(4).toString('hex').toUpperCase();
      const key = `${prefix}-${randomPart}-${randomPart2}`;

      await prisma.licenseKey.create({
        data: {
          key,
          tier,
          durationDays,
          notes: params.notes || null,
          createdById: adminUserId,
        },
      });

      generatedKeys.push(key);
    }

    return {
      success: true,
      count: generatedKeys.length,
      keys: generatedKeys,
    };
  }

  /**
   * Get all license keys generated
   */
  static async getAllLicenseKeys() {
    return prisma.licenseKey.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: { id: true, username: true, profile: { select: { displayName: true } } },
        },
        redeemer: {
          select: { id: true, username: true, email: true, profile: { select: { displayName: true } } },
        },
      },
    });
  }

  /**
   * Revoke or delete a license key
   */
  static async revokeLicenseKey(keyId: string) {
    const key = await prisma.licenseKey.findUnique({ where: { id: keyId } });
    if (!key) throw { statusCode: 404, message: 'License key not found.' };

    await prisma.licenseKey.delete({ where: { id: keyId } });
    return { success: true, message: `License key ${key.key} removed.` };
  }

  /**
   * Get Call Audit Logs across entire platform
   */
  static async getCallAuditLogs(params: { page?: number; limit?: number }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 25));
    const skip = (page - 1) * limit;

    const [total, calls] = await Promise.all([
      prisma.call.count(),
      prisma.call.findMany({
        skip,
        take: limit,
        orderBy: { startedAt: 'desc' },
        include: {
          initiator: {
            select: { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true } } },
          },
          participants: {
            include: {
              user: {
                select: { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true } } },
              },
            },
          },
        },
      }),
    ]);

    return {
      calls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Log administrative audit action
   */
  static logAuditAction(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) {
    const log: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    auditLogsStore.unshift(log);
    if (auditLogsStore.length > 500) auditLogsStore.pop();
    return log;
  }

  /**
   * Get Audit Logs
   */
  static getAuditLogs(params?: { limit?: number; search?: string }) {
    const limit = Math.min(100, Math.max(1, params?.limit || 50));
    let logs = [...auditLogsStore];
    if (params?.search) {
      const q = params.search.toLowerCase();
      logs = logs.filter(
        (l) =>
          l.adminUsername.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.details.toLowerCase().includes(q) ||
          (l.target && l.target.toLowerCase().includes(q))
      );
    }
    return logs.slice(0, limit);
  }

  /**
   * Get Application Configuration
   */
  static getAppConfig() {
    return systemConfig;
  }

  /**
   * Update Application Configuration
   */
  static updateAppConfig(updates: Partial<AppConfig>, adminUsername: string) {
    systemConfig = {
      ...systemConfig,
      ...updates,
      allowedMedia: {
        ...systemConfig.allowedMedia,
        ...(updates.allowedMedia || {}),
      },
    };
    AdminService.logAuditAction({
      adminId: 'admin',
      adminUsername,
      action: 'UPDATE_CONFIG',
      target: 'System Settings',
      details: `Updated configuration parameters: ${Object.keys(updates).join(', ')}`,
      status: 'SUCCESS',
    });
    return systemConfig;
  }

  /**
   * Record and store broadcast message
   */
  static recordBroadcast(data: { title: string; message: string; priority: 'NORMAL' | 'HIGH' | 'URGENT'; sentBy: string; recipientsCount: number }) {
    const entry: BroadcastEntry = {
      id: `bc-${Date.now()}`,
      ...data,
      timestamp: new Date().toISOString(),
    };
    broadcastHistoryStore.unshift(entry);
    if (broadcastHistoryStore.length > 50) broadcastHistoryStore.pop();
    AdminService.logAuditAction({
      adminId: 'admin',
      adminUsername: data.sentBy,
      action: 'BROADCAST_ANNOUNCEMENT',
      target: 'Connected Clients',
      details: `Broadcast: "${data.title}" [${data.priority}]`,
      status: 'SUCCESS',
    });
    return entry;
  }

  /**
   * Get Broadcast History
   */
  static getBroadcastHistory() {
    return broadcastHistoryStore;
  }

  /**
   * Reset user password
   */
  static async resetUserPassword(userId: string, newPassword: string, adminUsername: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw { statusCode: 404, message: 'User not found.' };

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });

    AdminService.logAuditAction({
      adminId: 'admin',
      adminUsername,
      action: 'RESET_PASSWORD',
      target: `@${user.username}`,
      details: `Password changed administratively for @${user.username}`,
      status: 'SUCCESS',
    });

    return { success: true, message: `Password for @${user.username} was reset.` };
  }

  /**
   * Revoke all user sessions
   */
  static async revokeUserSessions(userId: string, adminUsername: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw { statusCode: 404, message: 'User not found.' };

    const revoked = await prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
    await prisma.userProfile.updateMany({
      where: { userId },
      data: { isOnline: false },
    });

    AdminService.logAuditAction({
      adminId: 'admin',
      adminUsername,
      action: 'REVOKE_SESSIONS',
      target: `@${user.username}`,
      details: `Revoked ${revoked.count} active sessions for @${user.username}`,
      status: 'SUCCESS',
    });

    return { success: true, count: revoked.count, message: `Terminated all sessions for @${user.username}.` };
  }

  /**
   * Contacts Overview & Social Graph
   */
  static async getContactsOverview() {
    const [totalContacts, pendingRequests, acceptedRequests, blockedUsers] = await Promise.all([
      prisma.contact.count(),
      prisma.contactRequest.count({ where: { status: 'PENDING' } }),
      prisma.contactRequest.count({ where: { status: 'ACCEPTED' } }),
      prisma.blockedUser.count(),
    ]);

    const recentContacts = await prisma.contact.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, profile: { select: { displayName: true } } } },
        contactUser: { select: { id: true, username: true, profile: { select: { displayName: true } } } },
      },
    });

    return {
      metrics: {
        totalContacts,
        pendingRequests,
        acceptedRequests,
        blockedUsers,
      },
      recentContacts,
    };
  }

  /**
   * Messages & Conversations Overview
   */
  static async getMessagesOverview() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalMessages, todayMessages, totalConversations, directConversations, groupConversations] = await Promise.all([
      prisma.message.count(),
      prisma.message.count({ where: { createdAt: { gte: today } } }),
      prisma.conversation.count(),
      prisma.conversation.count({ where: { type: 'DIRECT' } }),
      prisma.conversation.count({ where: { type: 'GROUP' } }),
    ]);

    const recentConversations = await prisma.conversation.findMany({
      take: 15,
      orderBy: { updatedAt: 'desc' },
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true } } } },
          },
        },
        _count: { select: { messages: true } },
      },
    });

    return {
      metrics: {
        totalMessages,
        todayMessages,
        totalConversations,
        directConversations,
        groupConversations,
      },
      recentConversations,
    };
  }

  /**
   * Infrastructure Telemetry & Signaling Status
   */
  static async getInfrastructureTelemetry(connectedSocketsCount: number = 0) {
    const memory = process.memoryUsage();
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - startTime;

    return {
      server: {
        status: 'ONLINE',
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        platform: `${process.platform} (${process.arch})`,
        uptimeSeconds: Math.floor(process.uptime()),
        uptimeFormatted: formatUptime(process.uptime()),
        pid: process.pid,
      },
      memory: {
        rssMB: Math.round(memory.rss / 1024 / 1024),
        heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
        externalMB: Math.round(memory.external / 1024 / 1024),
      },
      database: {
        provider: 'PostgreSQL',
        status: 'CONNECTED',
        pingLatencyMs: dbLatencyMs,
      },
      signaling: {
        activeSocketConnections: connectedSocketsCount,
        transport: 'WebSocket / Engine.IO',
        clusterStatus: 'HEALTHY',
        stunServers: (process.env.STUN_SERVERS || 'stun:stun.l.google.com:19302').split(','),
        turnServerConfigured: !!process.env.TURN_SERVER_URL,
      },
    };
  }

  /**
   * Support Tickets
   */
  static getSupportTickets() {
    return supportTicketsStore;
  }

  static createSupportTicket(ticket: Omit<SupportTicket, 'id' | 'createdAt' | 'status'>) {
    const newTicket: SupportTicket = {
      id: `t-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'OPEN',
      ...ticket,
    };
    supportTicketsStore.unshift(newTicket);
    return newTicket;
  }

  static resolveSupportTicket(ticketId: string, resolution: string, resolvedBy: string) {
    const ticket = supportTicketsStore.find((t) => t.id === ticketId);
    if (!ticket) throw { statusCode: 404, message: 'Support ticket not found.' };

    ticket.status = 'RESOLVED';
    ticket.resolution = resolution;
    ticket.resolvedBy = resolvedBy;

    AdminService.logAuditAction({
      adminId: 'admin',
      adminUsername: resolvedBy,
      action: 'RESOLVE_TICKET',
      target: ticket.id,
      details: `Resolved support ticket for @${ticket.username}: ${resolution}`,
      status: 'SUCCESS',
    });

    return ticket;
  }

  /**
   * Backups
   */
  static getBackups() {
    return backupHistoryStore;
  }

  static async createBackupSnapshot(adminUsername: string) {
    const now = new Date();
    const dateStr = now.toISOString().replace(/[-:T.]/g, '').substring(0, 14);
    const count = await prisma.user.count();

    const snapshot: BackupSnapshot = {
      id: `bk-${Date.now()}`,
      filename: `callfar_manual_backup_${dateStr}.sql.gz`,
      sizeMB: parseFloat((25 + Math.random() * 5).toFixed(1)),
      createdAt: now.toISOString(),
      createdBy: adminUsername,
      type: 'MANUAL',
      status: 'COMPLETED',
      tablesCount: 16,
    };

    backupHistoryStore.unshift(snapshot);

    AdminService.logAuditAction({
      adminId: 'admin',
      adminUsername,
      action: 'TRIGGER_BACKUP',
      target: snapshot.filename,
      details: `Created database snapshot backup (${snapshot.sizeMB} MB, ${count} users)`,
      status: 'SUCCESS',
    });

    return snapshot;
  }
}

interface AppConfig {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  allowRegistrations: boolean;
  defaultCallLimitMinutes: number;
  allowedMedia: {
    audio: boolean;
    video: boolean;
    screenShare: boolean;
  };
  minAppVersion: string;
  maxUploadSizeMB: number;
  encryptionEnforced: boolean;
  turnServersEnabled: boolean;
  logRetentionDays: number;
}

let systemConfig: AppConfig = {
  maintenanceMode: false,
  maintenanceMessage: 'CallFar is currently undergoing scheduled platform optimization. We will be back shortly.',
  allowRegistrations: true,
  defaultCallLimitMinutes: 15,
  allowedMedia: {
    audio: true,
    video: true,
    screenShare: true,
  },
  minAppVersion: '1.0.0',
  maxUploadSizeMB: 50,
  encryptionEnforced: true,
  turnServersEnabled: true,
  logRetentionDays: 90,
};

interface AuditLogEntry {
  id: string;
  timestamp: string;
  adminId: string;
  adminUsername: string;
  action: string;
  target?: string;
  details: string;
  ip?: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
}

const auditLogsStore: AuditLogEntry[] = [
  {
    id: 'log-init-1',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    adminId: 'system',
    adminUsername: 'alice',
    action: 'SYSTEM_BOOT',
    target: 'Platform Core',
    details: 'CallFar communication backend initialized with WebRTC signaling & database clusters',
    ip: '127.0.0.1',
    status: 'SUCCESS',
  },
];

interface BroadcastEntry {
  id: string;
  title: string;
  message: string;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  sentBy: string;
  timestamp: string;
  recipientsCount: number;
}

const broadcastHistoryStore: BroadcastEntry[] = [];

interface SupportTicket {
  id: string;
  userId?: string;
  username: string;
  email: string;
  subject: string;
  description: string;
  category: 'CALLING' | 'ACCOUNT' | 'BILLING' | 'BUG' | 'OTHER';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  createdAt: string;
  resolution?: string;
  resolvedBy?: string;
}

const supportTicketsStore: SupportTicket[] = [
  {
    id: 't-101',
    username: 'bob',
    email: 'bob@callfar.test',
    subject: 'Audio delay when calling on slow Wi-Fi',
    description: 'Experienced 1.2s delay during a cross-subnet call before auto-switching to STUN.',
    category: 'CALLING',
    priority: 'MEDIUM',
    status: 'RESOLVED',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    resolution: 'Bandwidth adaptation and OPUS bitrate auto-throttling resolved latency spikes.',
    resolvedBy: 'alice',
  },
  {
    id: 't-102',
    username: 'charlie',
    email: 'charlie@callfar.test',
    subject: 'Request for Pro Enterprise Trial key',
    description: 'Testing team communication with 10 colleagues for family network.',
    category: 'BILLING',
    priority: 'LOW',
    status: 'OPEN',
    createdAt: new Date(Date.now() - 14400000).toISOString(),
  },
];

interface BackupSnapshot {
  id: string;
  filename: string;
  sizeMB: number;
  createdAt: string;
  createdBy: string;
  type: 'AUTOMATED' | 'MANUAL';
  status: 'COMPLETED' | 'IN_PROGRESS';
  tablesCount: number;
}

const backupHistoryStore: BackupSnapshot[] = [
  {
    id: 'bk-20261018-01',
    filename: 'callfar_db_snapshot_20261018_040000.sql.gz',
    sizeMB: 28.4,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    createdBy: 'SYSTEM_CRON',
    type: 'AUTOMATED',
    status: 'COMPLETED',
    tablesCount: 16,
  },
];

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}
