import jwt, { SignOptions } from 'jsonwebtoken';
import { ENV } from '../config/env.js';

export interface TokenPayload {
  userId: string;
  email: string;
  username: string;
  role?: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  const options: SignOptions = {
    expiresIn: ENV.JWT_ACCESS_EXPIRATION as any,
  };
  return jwt.sign(payload, ENV.JWT_ACCESS_SECRET, options);
}

export function generateRefreshToken(payload: TokenPayload): string {
  const options: SignOptions = {
    expiresIn: `${ENV.JWT_REFRESH_EXPIRATION_DAYS}d` as any,
  };
  return jwt.sign(payload, ENV.JWT_REFRESH_SECRET, options);
}

export function verifyAccessToken(token: string): TokenPayload {
  // Allow 2-minute clock skew/grace so tokens expiring mid-session
  // don't immediately cause 401 on settings, ringtone, or other API saves.
  return jwt.verify(token, ENV.JWT_ACCESS_SECRET, { clockTolerance: 120 }) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, ENV.JWT_REFRESH_SECRET) as TokenPayload;
}
