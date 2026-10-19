import crypto from 'crypto';
import bcrypt from 'bcryptjs';

let argon2: any = null;
try {
  argon2 = require('argon2');
} catch {
  // Argon2 native module fallback if not compiled
  argon2 = null;
}

/**
 * Hash password securely with Argon2id if available, otherwise bcryptjs (cost 12)
 */
export async function hashPassword(plainText: string): Promise<string> {
  if (argon2) {
    try {
      return await argon2.hash(plainText, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16, // 64 MB
        timeCost: 3,
        parallelism: 1,
      });
    } catch {
      // Fallback to bcrypt
    }
  }
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plainText, salt);
}

/**
 * Compare candidate password with stored hash
 */
export async function comparePassword(candidate: string, hash: string): Promise<boolean> {
  if (hash.startsWith('$argon2') && argon2) {
    try {
      return await argon2.verify(hash, candidate);
    } catch {
      return false;
    }
  }
  return bcrypt.compare(candidate, hash);
}

/**
 * Hash refresh token before persisting to database
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a cryptographically secure random token string
 */
export function generateRandomToken(bytes = 40): string {
  return crypto.randomBytes(bytes).toString('hex');
}
