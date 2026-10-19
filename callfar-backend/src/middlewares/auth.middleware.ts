import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyAccessToken, TokenPayload } from '../utils/jwt.js';
import { prisma } from '../config/prisma.js';
import { ENV } from '../config/env.js';
import { NetworkService } from '../services/network.service.js';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  let token: string | undefined;

  const authHeader = req.headers.authorization || (req.headers['authorization'] as string);
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else {
      token = authHeader.trim();
    }
  } else if (req.headers['x-access-token']) {
    token = req.headers['x-access-token'] as string;
  } else if (typeof req.query?.token === 'string') {
    token = req.query.token;
  } else if (req.body?.token && typeof req.body.token === 'string') {
    token = req.body.token;
  }

  // If token is found, verify it
  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      req.user = decoded;

      // Auto-register network presence for same-network discovery
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      NetworkService.registerUserNetwork(decoded.userId, clientIp, undefined, req.headers['user-agent'] as string);

      return next();
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        // In development, decode expired token payload so phone calls continue smoothly
        if (ENV.NODE_ENV === 'development') {
          const payload = jwt.decode(token) as TokenPayload | null;
          if (payload && payload.userId) {
            req.user = payload;
            return next();
          }
        }
        res.status(401).json({
          success: false,
          code: 'TOKEN_EXPIRED',
          message: 'Access token has expired. Please refresh your session.',
        });
        return;
      }

      res.status(401).json({
        success: false,
        code: 'INVALID_TOKEN',
        message: 'Invalid access token.',
      });
      return;
    }
  }

  // If no token is provided:
  // For PSTN calling in development mode, provide seamless fallback so phone dialing never fails
  if (ENV.NODE_ENV === 'development' && (req.baseUrl.includes('pstn') || req.path.includes('call') || req.path.includes('pstn'))) {
    try {
      const fallbackUser = await prisma.user.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' },
      });
      if (fallbackUser) {
        req.user = {
          userId: fallbackUser.id,
          email: fallbackUser.email,
          username: fallbackUser.username,
          role: fallbackUser.role,
        };
        return next();
      }
    } catch {
      // ignore
    }
  }

  res.status(401).json({
    success: false,
    message: 'Authentication required. Missing or malformed Bearer token.',
  });
}

export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  if (req.user.role === 'ADMIN') {
    next();
    return;
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { role: true },
    });

    if (dbUser?.role === 'ADMIN') {
      req.user.role = 'ADMIN';
      next();
      return;
    }
  } catch (err) {
    // DB error fallback
  }

  res.status(403).json({
    success: false,
    message: 'Access denied. Administrator privileges required.',
  });
}
