import { prisma } from '../config/prisma.js';
import { CallType, CallStatus, ParticipantStatus } from '@prisma/client';
import { ENV } from '../config/env.js';

export class CallService {
  /**
   * Return ICE Servers configuration (STUN + optional TURN)
   */
  static getIceServers() {
    const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [];

    // Add STUN servers
    if (ENV.STUN_SERVERS && ENV.STUN_SERVERS.length > 0) {
      iceServers.push({ urls: ENV.STUN_SERVERS });
    }

    // Add TURN if configured
    if (ENV.TURN_SERVER_URL) {
      iceServers.push({
        urls: ENV.TURN_SERVER_URL,
        username: ENV.TURN_SERVER_USERNAME,
        credential: ENV.TURN_SERVER_CREDENTIAL,
      });
    }

    return iceServers;
  }

  /**
   * Initialize a new call record
   */
  static async initiateCall(initiatorId: string, receiverId: string, callType: CallType = CallType.VOICE) {
    const isSelfCall = initiatorId === receiverId;

    const participantsData = isSelfCall
      ? [{ userId: initiatorId, status: ParticipantStatus.CONNECTED, joinedAt: new Date() }]
      : [
          { userId: initiatorId, status: ParticipantStatus.CONNECTED, joinedAt: new Date() },
          { userId: receiverId, status: ParticipantStatus.INVITED },
        ];

    const call = await prisma.$transaction(async (tx) => {
      const newCall = await tx.call.create({
        data: {
          initiatorId,
          callType,
          status: isSelfCall ? CallStatus.ONGOING : CallStatus.INITIATED,
          startedAt: isSelfCall ? new Date() : undefined,
          participants: {
            create: participantsData,
          },
        },
        include: {
          initiator: {
            select: {
              id: true,
              username: true,
              profile: { select: { displayName: true, avatarUrl: true } },
            },
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  profile: { select: { displayName: true, avatarUrl: true } },
                },
              },
            },
          },
        },
      });

      return newCall;
    });

    return call;
  }

  /**
   * Mark call as answered / ongoing
   */
  static async answerCall(callId: string, userId: string) {
    const call = await prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) throw { statusCode: 404, message: 'Call not found.' };

    const updated = await prisma.$transaction(async (tx) => {
      await tx.callParticipant.updateMany({
        where: { callId, userId },
        data: { status: ParticipantStatus.CONNECTED, joinedAt: new Date() },
      });

      return tx.call.update({
        where: { id: callId },
        data: { status: CallStatus.ONGOING, answeredAt: new Date() },
      });
    });

    return updated;
  }

  /**
   * End a call and record duration
   */
  static async endCall(callId: string, finalStatus: CallStatus = CallStatus.COMPLETED) {
    const call = await prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) return null;

    const now = new Date();
    let durationSeconds = 0;

    if (call.answeredAt) {
      durationSeconds = Math.max(0, Math.floor((now.getTime() - call.answeredAt.getTime()) / 1000));
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.callParticipant.updateMany({
        where: { callId, leftAt: null },
        data: { leftAt: now },
      });

      return tx.call.update({
        where: { id: callId },
        data: {
          status: finalStatus,
          endedAt: now,
          durationSeconds,
        },
      });
    });

    return updated;
  }

  /**
   * Get call history for a user
   */
  static async getCallHistory(userId: string, limit = 40) {
    const calls = await prisma.call.findMany({
      where: {
        OR: [
          { initiatorId: userId },
          { participants: { some: { userId } } },
        ],
      },
      take: limit,
      orderBy: { startedAt: 'desc' },
      include: {
        initiator: {
          select: {
            id: true,
            username: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                profile: { select: { displayName: true, avatarUrl: true } },
              },
            },
          },
        },
      },
    });

    return calls.map((call) => {
      const isInitiator = call.initiatorId === userId;
      const peerParticipant = call.participants.find((p) => p.userId !== userId);
      const peer = isInitiator ? peerParticipant?.user : call.initiator;

      return {
        id: call.id,
        callType: call.callType,
        status: call.status,
        isOutgoing: isInitiator,
        peer: peer
          ? {
              id: peer.id,
              username: peer.username,
              displayName: peer.profile?.displayName || peer.username,
              avatarUrl: peer.profile?.avatarUrl,
            }
          : null,
        startedAt: call.startedAt,
        answeredAt: call.answeredAt,
        endedAt: call.endedAt,
        durationSeconds: call.durationSeconds,
      };
    });
  }
}
