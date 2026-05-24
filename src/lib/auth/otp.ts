/**
 * OTP code generation, storage, and verification.
 *
 * Uses the OtpCode Prisma model. Codes are 6-digit numeric strings
 * that expire after 10 minutes with a maximum of 3 verification attempts.
 */

import { db } from '@/lib/db';
import { createLogger } from '@/lib/utils';
import crypto from 'crypto';

const log = createLogger('auth:otp');

const CODE_LENGTH = 6;
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 3;
const FAILED_WINDOW_MS = 15 * 60 * 1000; // 15 min window for counting total failures
const MAX_TOTAL_FAILURES = 10; // lockout after this many failures in the window

/**
 * Generate a cryptographically random 6-digit code.
 */
function generateCode(): string {
  // Generate a random number between 0 and 999999, zero-padded
  const num = crypto.randomInt(0, 10 ** CODE_LENGTH);
  return num.toString().padStart(CODE_LENGTH, '0');
}

/**
 * Create and store a new OTP code for the given identifier (email or phone).
 * Deletes any previous codes for that identifier before creating a new one.
 */
export async function createOtp(
  identifier: string,
  type: 'email' | 'phone',
): Promise<string> {
  const normalizedId = identifier.toLowerCase().trim();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  // Delete any existing codes for this identifier
  await db.otpCode.deleteMany({ where: { identifier: normalizedId } });

  await db.otpCode.create({
    data: {
      identifier: normalizedId,
      code,
      type,
      expiresAt,
    },
  });

  const redacted = normalizedId.replace(/.(?=.{3})/g, '*');
  log.info('OTP created', { identifier: redacted, type });
  return code;
}

/**
 * Verify an OTP code. Returns true if valid, false otherwise.
 * Increments the attempt counter and deletes the code after success or max attempts.
 */
export async function verifyOtp(
  identifier: string,
  code: string,
): Promise<boolean> {
  const normalizedId = identifier.toLowerCase().trim();

  const record = await db.otpCode.findFirst({
    where: {
      identifier: normalizedId,
      code: code.trim(),
    },
  });

  const redacted = normalizedId.replace(/.(?=.{3})/g, '*');

  if (!record) {
    log.warn('OTP not found', { identifier: redacted });
    // Check account-level brute force lockout
    const failures = await countRecentFailures(normalizedId);
    if (failures >= MAX_TOTAL_FAILURES) {
      log.warn('OTP account locked due to too many failures', { identifier: redacted, failures });
    }
    return false;
  }

  // Check expiry
  if (record.expiresAt < new Date()) {
    log.warn('OTP expired', { identifier: redacted });
    await db.otpCode.delete({ where: { id: record.id } }).catch(() => {});
    return false;
  }

  // Check account-level brute force lockout
  const failures = await countRecentFailures(normalizedId);
  if (failures >= MAX_TOTAL_FAILURES) {
    log.warn('OTP account locked due to too many failures', { identifier: redacted, failures });
    await db.otpCode.delete({ where: { id: record.id } }).catch(() => {});
    return false;
  }

  // Check per-code attempts
  if (record.attempts >= MAX_ATTEMPTS) {
    log.warn('OTP max attempts exceeded', { identifier: redacted });
    await db.otpCode.delete({ where: { id: record.id } }).catch(() => {});
    return false;
  }

  // Increment attempts
  await db.otpCode.update({
    where: { id: record.id },
    data: { attempts: { increment: 1 } },
  });

  // Code matches — delete and return success
  await db.otpCode.delete({ where: { id: record.id } }).catch(() => {});
  log.info('OTP verified', { identifier: redacted });
  return true;
}

/**
 * Count how many failed OTP verification attempts occurred for an identifier
 * within the recent window (for account-level brute force protection).
 */
async function countRecentFailures(identifier: string): Promise<number> {
  const windowStart = new Date(Date.now() - FAILED_WINDOW_MS);
  const recentCodes = await db.otpCode.findMany({
    where: {
      identifier,
      createdAt: { gte: windowStart },
    },
    select: { attempts: true },
  });
  return recentCodes.reduce((sum, c) => sum + c.attempts, 0);
}

/**
 * Cleanup expired OTP codes. Call periodically (e.g. via cron).
 */
export async function cleanupExpiredOtps(): Promise<number> {
  const result = await db.otpCode.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  if (result.count > 0) {
    log.info('Cleaned up expired OTPs', { count: result.count });
  }
  return result.count;
}
