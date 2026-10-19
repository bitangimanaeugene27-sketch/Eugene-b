import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { verifyAccessToken, TokenPayload } from '../utils/jwt.js';
import { prisma } from '../config/prisma.js';
import { CallService } from '../services/call.service.js';
import { MessageService } from '../services/message.service.js';
import { NetworkService } from '../services/network.service.js';
import { CallStatus, CallType } from '@prisma/client';
import { ENV } from '../config/env.js';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

let socketServerInstance: SocketIOServer | null = null;

export function getSocketServer(): SocketIOServer | null {
  return socketServerInstance;
}

export function setupSocketServer(httpServer: HttpServer, corsOrigin: string) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 15000,
  });

  socketServerInstance = io;

  // Socket Authentication Middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication token required for Socket connection.'));
    }

    try {
      const decoded = verifyAccessToken(token);
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      next();
    } catch (err: any) {
      // In development or local LAN, decode expired token payload so phone calls never drop
      if (ENV.NODE_ENV === 'development' || err.name === 'TokenExpiredError') {
        try {
          const payload = jwt.decode(token) as TokenPayload | null;
          if (payload && payload.userId) {
            socket.userId = payload.userId;
            socket.username = payload.username;
            return next();
          }
        } catch {}
      }
      next(new Error('Invalid or expired socket token.'));
    }
  });

  io.on('connection', async (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    const username = socket.username!;

    // Register active network connection (LAN / WAN detection)
    const clientIp = (socket.handshake.headers['x-forwarded-for'] as string) || socket.handshake.address;
    NetworkService.registerUserNetwork(userId, clientIp, socket.id, socket.handshake.headers['user-agent'] as string);

    console.log(`[Socket Connected] User ${username} (${userId}) on ${NetworkService.normalizeIp(clientIp)} [${NetworkService.isPrivateLan(clientIp) ? 'SAME_LAN' : 'WAN'}]`);

    // Join personal user room for targeted notifications & calls
    socket.join(`user:${userId}`);

    // Update presence status to online
    await prisma.userProfile.updateMany({
      where: { userId },
      data: { isOnline: true, lastSeen: new Date() },
    });

    // Broadcast online status to contacts
    socket.broadcast.emit('presence:update', { userId, isOnline: true });

    // ==========================================
    // 1. WEBRTC CALL SIGNALING EVENTS
    // ==========================================

    /**
     * Outgoing Call Invitation
     */
    socket.on('call:invite', async (data: {
      receiverId: string;
      callType: 'VOICE' | 'VIDEO';
      offerSdp?: any;
    }) => {
      try {
        const { receiverId, callType, offerSdp } = data;

        // Verify receiver exists and is not blocking sender
        const isBlocked = await prisma.blockedUser.findFirst({
          where: {
            OR: [
              { blockerId: receiverId, blockedId: userId },
              { blockerId: userId, blockedId: receiverId },
            ],
          },
        });

        if (isBlocked) {
          socket.emit('call:error', { message: 'Cannot place call to this user.' });
          return;
        }

        // Special handling: Call Myself (Echo Test / Audio Assistant)
        if (receiverId === userId) {
          const call = await CallService.initiateCall(
            userId,
            receiverId,
            callType === 'VIDEO' ? CallType.VIDEO : CallType.VOICE
          );

          socket.emit('call:ringing', { callId: call.id, isSelfCall: true });

          // Auto-answer after ringback tone plays for 1.8 seconds
          setTimeout(() => {
            socket.emit('call:accepted', {
              callId: call.id,
              isSelfCall: true,
              answerSdp: offerSdp || null,
            });
          }, 1800);
          return;
        }

        // Create call record in PostgreSQL
        const call = await CallService.initiateCall(
          userId,
          receiverId,
          callType === 'VIDEO' ? CallType.VIDEO : CallType.VOICE
        );

        // Fetch caller profile
        const callerProfile = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        });

        const topology = NetworkService.getTopologyBetween(userId, receiverId);

        // Notify receiver
        io.to(`user:${receiverId}`).emit('call:incoming', {
          callId: call.id,
          caller: callerProfile,
          callType,
          offerSdp,
          networkTopology: topology,
        });

        // Acknowledge caller that call is ringing
        socket.emit('call:ringing', { callId: call.id, networkTopology: topology });
      } catch (err: any) {
        console.error('[call:invite error]:', err);
        socket.emit('call:error', { message: err.message || 'Failed to initiate call.' });
      }
    });

    /**
     * Receiver Accepts Call
     */
    socket.on('call:accept', async (data: { callId: string; callerId: string; answerSdp: any }) => {
      try {
        const { callId, callerId, answerSdp } = data;

        // Update call status to ONGOING
        await CallService.answerCall(callId, userId);

        const topology = NetworkService.getTopologyBetween(callerId, userId);

        // Deliver answer SDP to caller
        io.to(`user:${callerId}`).emit('call:accepted', {
          callId,
          responderId: userId,
          answerSdp,
          networkTopology: topology,
        });
      } catch (err: any) {
        console.error('[call:accept error]:', err);
      }
    });

    /**
     * Receiver Declines/Rejects Call
     */
    socket.on('call:reject', async (data: { callId: string; callerId: string; reason?: string }) => {
      try {
        const { callId, callerId, reason } = data;

        if (callId) {
          await CallService.endCall(callId, CallStatus.REJECTED);
        }

        io.to(`user:${callerId}`).emit('call:rejected', {
          callId,
          reason: reason || 'DECLINED',
        });
      } catch (err: any) {
        console.error('[call:reject error]:', err);
      }
    });

    /**
     * Relay ICE Candidate between peers
     */
    socket.on('call:ice-candidate', (data: { targetUserId: string; callId: string; candidate: any }) => {
      const { targetUserId, callId, candidate } = data;
      io.to(`user:${targetUserId}`).emit('call:ice-candidate', {
        callId,
        fromUserId: userId,
        candidate,
      });
    });

    /**
     * Either Party Ends/Hangs up Call
     */
    socket.on('call:end', async (data: { callId: string; peerId: string }) => {
      try {
        const { callId, peerId } = data;

        // Guard: skip DB lookup if callId is empty (call never fully established)
        if (!callId || callId.trim() === '') {
          io.to(`user:${peerId}`).emit('call:ended', { callId: '', durationSeconds: 0, isMissed: true });
          return;
        }

        const existingCall = await prisma.call.findUnique({
          where: { id: callId },
        });

        if (!existingCall) {
          io.to(`user:${peerId}`).emit('call:ended', { callId, durationSeconds: 0, isMissed: false });
          return;
        }

        const isMissed = !existingCall.answeredAt;
        const finalStatus = isMissed ? CallStatus.MISSED : CallStatus.COMPLETED;

        const updatedCall = await CallService.endCall(callId, finalStatus);

        const caller = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        });

        if (isMissed) {
          // Emit explicit missed call notification to receiver
          io.to(`user:${peerId}`).emit('call:missed', {
            callId,
            caller,
            callType: existingCall.callType || 'VOICE',
            timestamp: new Date().toISOString(),
          });
        }

        io.to(`user:${peerId}`).emit('call:ended', {
          callId,
          durationSeconds: updatedCall?.durationSeconds || 0,
          isMissed,
        });
      } catch (err: any) {
        console.error('[call:end error]:', err);
      }
    });

    // ==========================================
    // 2. REAL-TIME CHAT EVENTS
    // ==========================================

    socket.on('chat:send', async (data: {
      conversationId: string;
      targetUserId: string;
      content: string;
    }) => {
      try {
        const { conversationId, targetUserId, content } = data;

        const message = await MessageService.sendMessage(conversationId, userId, content);

        // Emit to target user
        io.to(`user:${targetUserId}`).emit('chat:new_message', {
          conversationId,
          message,
        });

        // Acknowledge back to sender
        socket.emit('chat:message_sent', {
          conversationId,
          message,
        });
      } catch (err: any) {
        console.error('[chat:send error]:', err);
        socket.emit('chat:error', { message: err.message || 'Failed to send message.' });
      }
    });

    socket.on('chat:typing', (data: { targetUserId: string; isTyping: boolean }) => {
      const { targetUserId, isTyping } = data;
      io.to(`user:${targetUserId}`).emit('chat:user_typing', {
        userId,
        isTyping,
      });
    });

    // ==========================================
    // 3. DISCONNECTION & PRESENCE CLEANUP
    // ==========================================
    socket.on('disconnect', async () => {
      console.log(`[Socket Disconnected] User ${username} on socket ${socket.id}`);
      NetworkService.unregisterUserNetwork(userId);

      // Check if user has other active sockets (multi-tab/device)
      const userSockets = await io.in(`user:${userId}`).fetchSockets();
      if (userSockets.length === 0) {
        await prisma.userProfile.updateMany({
          where: { userId },
          data: { isOnline: false, lastSeen: new Date() },
        });

        socket.broadcast.emit('presence:update', { userId, isOnline: false });
      }
    });
  });

  return io;
}
