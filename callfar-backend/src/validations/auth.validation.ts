import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must have at least 2 characters').max(60),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  phoneNumber: z
    .string()
    .regex(/^\+?[1-9]\d{6,14}$/, 'Phone number must be a valid international E.164 format')
    .optional(),
  deviceId: z.string().optional(),
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
  adminPasscode: z.string().optional(),
});

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
  deviceId: z.string().optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const elevateAdminSchema = z.object({
  adminPasscode: z.string().min(1, 'Admin security passcode is required'),
});
