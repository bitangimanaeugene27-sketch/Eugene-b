import { z } from 'zod';

// Strict RFC 5322 compliant regex requiring valid local part, domain labels, and TLD (min 2 letters) without consecutive dots
export const EMAIL_REGEX = /^[a-zA-Z0-9_%+-]+(?:\.[a-zA-Z0-9_%+-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must have at least 2 characters').max(60),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address')
    .regex(EMAIL_REGEX, 'Please enter a valid email address with a valid domain (e.g. user@example.com)'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{6,14}$/, 'Phone number must be a valid international E.164 format')
    .optional(),
  deviceId: z.string().optional(),
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
  adminPasscode: z.string().optional(),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
  deviceId: z.string().optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const elevateAdminSchema = z.object({
  adminPasscode: z.string().min(1, 'Admin security passcode is required'),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address format')
    .regex(EMAIL_REGEX, 'Please enter a valid email address with a valid domain (e.g. user@example.com)'),
});

export const resetPasswordSchema = z.object({
  tokenOrCode: z.string().trim().min(6, 'Reset token or 6-digit verification code is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});
