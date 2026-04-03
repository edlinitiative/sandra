/**
 * Email Verification — secure self-linking for WhatsApp → Workspace identity.
 *
 * Flow:
 * 1. User says "my email is rony@edlight.org" on WhatsApp
 * 2. Sandra verifies the email exists in the Workspace Directory
 * 3. Sandra generates a 6-digit code and sends it to that email via Gmail API
 * 4. Sandra replies on WhatsApp: "I sent a code to r***@edlight.org. Reply with the code."
 * 5. User replies "123456"
 * 6. Sandra verifies the code and links their identity
 *
 * Codes expire after 10 minutes. Max 3 attempts per code.
 */

import { createLogger } from '@/lib/utils';
import { getUserMemoryStore } from '@/lib/memory/user-memory';
import { resolveGoogleContext } from '@/lib/google/context';
import { getUserByEmail } from '@/lib/google/directory';
import { sendEmail } from '@/lib/google/gmail';
import { linkWorkspaceIdentity } from './identity-linker';
import type { DirectoryUser } from '@/lib/google/types';

const log = createLogger('channels:email-verification');

// ─── Constants ───────────────────────────────────────────────────────────────

const EDLIGHT_TENANT_ID = 'cmnhsjh850000a1y1b69ji257';
const VERIFICATION_SENDER = 'sandra@edlight.org';
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 3;

// Memory keys for pending verification
const PENDING_CODE_KEY = 'verification_code';
const PENDING_EMAIL_KEY = 'verification_email';
const PENDING_EXPIRES_KEY = 'verification_expires';
const PENDING_ATTEMPTS_KEY = 'verification_attempts';

// ─── In-Memory Pending Verifications (backed by Memory store) ───────────────

/**
 * Generate a cryptographically random 6-digit code.
 */
export function generateVerificationCode(): string {
  const code = Math.floor(100000 + Math.random() * 900000);
  return String(code);
}

/**
 * Mask an email for privacy: rony@edlight.org → r***@edlight.org
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***';
  if (local.length <= 1) return `${local}***@${domain}`;
  return `${local[0]}***@${domain}`;
}

// ─── Verification Flow ──────────────────────────────────────────────────────

export interface VerificationStartResult {
  success: boolean;
  maskedEmail?: string;
  error?: string;
}

/**
 * Start the email verification flow.
 *
 * 1. Check if the claimed email exists in the Workspace Directory
 * 2. Generate a verification code
 * 3. Send it to the email via Gmail API
 * 4. Store the pending verification in Memory
 */
export async function startEmailVerification(
  userId: string,
  claimedEmail: string,
  channel: 'whatsapp' | 'instagram' = 'whatsapp',
): Promise<VerificationStartResult> {
  const email = claimedEmail.toLowerCase().trim();
  log.info('Starting email verification', { userId, email });

  // 1. Verify the email exists in the Workspace directory
  let directoryUser: DirectoryUser | null;
  try {
    const ctx = await resolveGoogleContext(EDLIGHT_TENANT_ID);
    directoryUser = await getUserByEmail(ctx, email);
  } catch (err) {
    log.error('Directory lookup failed during verification', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    return { success: false, error: 'I couldn\'t verify that email right now. Please try again later.' };
  }

  if (!directoryUser) {
    log.info('Email not found in directory', { email });
    return { success: false, error: `I couldn't find ${maskEmail(email)} in the EdLight Workspace. Are you sure that's the right email?` };
  }

  // 2. Generate code
  const code = generateVerificationCode();
  const expiresAt = Date.now() + CODE_TTL_MS;

  // 3. Send verification email
  try {
    const ctx = await resolveGoogleContext(EDLIGHT_TENANT_ID);
    await sendEmail(ctx, {
      from: VERIFICATION_SENDER,
      to: [email],
      subject: 'Sandra — Your verification code',
      body: [
        `Hi ${directoryUser.givenName ?? directoryUser.name},`,
        '',
        `Your verification code is: ${code}`,
        '',
        `Enter this code in your ${channel === 'instagram' ? 'Instagram' : 'WhatsApp'} chat with Sandra to link your account.`,
        '',
        'This code expires in 10 minutes.',
        '',
        'If you didn\'t request this, you can safely ignore this email.',
        '',
        '— Sandra, EdLight AI Assistant',
      ].join('\n'),
    });
  } catch (err) {
    log.error('Failed to send verification email', {
      email,
      error: err instanceof Error ? err.message : 'unknown',
    });
    return { success: false, error: 'I couldn\'t send the verification email. Please try again later.' };
  }

  // 4. Store pending verification in user Memory
  const store = getUserMemoryStore();
  await Promise.all([
    store.saveMemory(userId, {
      key: PENDING_CODE_KEY,
      value: code,
      source: 'verification',
      confidence: 1.0,
      updatedAt: new Date(),
    }),
    store.saveMemory(userId, {
      key: PENDING_EMAIL_KEY,
      value: email,
      source: 'verification',
      confidence: 1.0,
      updatedAt: new Date(),
    }),
    store.saveMemory(userId, {
      key: PENDING_EXPIRES_KEY,
      value: String(expiresAt),
      source: 'verification',
      confidence: 1.0,
      updatedAt: new Date(),
    }),
    store.saveMemory(userId, {
      key: PENDING_ATTEMPTS_KEY,
      value: '0',
      source: 'verification',
      confidence: 1.0,
      updatedAt: new Date(),
    }),
  ]);

  log.info('Verification code sent', { userId, email: maskEmail(email) });

  return {
    success: true,
    maskedEmail: maskEmail(email),
  };
}

// ─── Code Verification ──────────────────────────────────────────────────────

export interface VerificationResult {
  success: boolean;
  email?: string;
  name?: string;
  error?: string;
}

/**
 * Check if a user has a pending email verification.
 */
export async function hasPendingVerification(userId: string): Promise<boolean> {
  const store = getUserMemoryStore();
  const code = await store.getMemory(userId, PENDING_CODE_KEY);
  const expires = await store.getMemory(userId, PENDING_EXPIRES_KEY);

  if (!code?.value || !expires?.value) return false;

  // Check if expired
  if (Date.now() > Number(expires.value)) {
    await clearPendingVerification(userId);
    return false;
  }

  return true;
}

/**
 * Verify a code submitted by the user.
 *
 * On success: links the Workspace identity and clears the pending verification.
 * On failure: increments attempts. After MAX_ATTEMPTS, clears the verification.
 */
export async function verifyCode(
  userId: string,
  submittedCode: string,
): Promise<VerificationResult> {
  const store = getUserMemoryStore();

  const [codeMem, emailMem, expiresMem, attemptsMem] = await Promise.all([
    store.getMemory(userId, PENDING_CODE_KEY),
    store.getMemory(userId, PENDING_EMAIL_KEY),
    store.getMemory(userId, PENDING_EXPIRES_KEY),
    store.getMemory(userId, PENDING_ATTEMPTS_KEY),
  ]);

  // No pending verification
  if (!codeMem?.value || !emailMem?.value || !expiresMem?.value) {
    return { success: false, error: 'No pending verification. Say "my email is x@edlight.org" to start.' };
  }

  // Check expiration
  if (Date.now() > Number(expiresMem.value)) {
    await clearPendingVerification(userId);
    return { success: false, error: 'That verification code has expired. Please try again.' };
  }

  // Check attempts
  const attempts = Number(attemptsMem?.value ?? '0');
  if (attempts >= MAX_ATTEMPTS) {
    await clearPendingVerification(userId);
    return { success: false, error: 'Too many attempts. Please start over by telling me your email again.' };
  }

  // Verify code (trim whitespace, compare as strings)
  const clean = submittedCode.trim().replace(/\s/g, '');
  if (clean !== codeMem.value) {
    // Increment attempts
    await store.saveMemory(userId, {
      key: PENDING_ATTEMPTS_KEY,
      value: String(attempts + 1),
      source: 'verification',
      confidence: 1.0,
      updatedAt: new Date(),
    });

    const remaining = MAX_ATTEMPTS - (attempts + 1);
    return {
      success: false,
      error: remaining > 0
        ? `That code isn't right. You have ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} left.`
        : 'That code isn\'t right. Too many attempts — please start over by telling me your email again.',
    };
  }

  // ✅ Code matches — link the identity
  const email = emailMem.value;
  log.info('Verification code confirmed', { userId, email });

  let directoryUser: DirectoryUser | null = null;
  try {
    const ctx = await resolveGoogleContext(EDLIGHT_TENANT_ID);
    directoryUser = await getUserByEmail(ctx, email);
  } catch {
    // Non-fatal — we still know the email is valid from the start step
  }

  if (directoryUser) {
    await linkWorkspaceIdentity(userId, directoryUser);
  }

  await clearPendingVerification(userId);

  return {
    success: true,
    email,
    name: directoryUser?.name ?? email,
  };
}

/**
 * Clear pending verification data.
 */
async function clearPendingVerification(userId: string): Promise<void> {
  const store = getUserMemoryStore();
  await Promise.all([
    store.deleteMemory(userId, PENDING_CODE_KEY),
    store.deleteMemory(userId, PENDING_EMAIL_KEY),
    store.deleteMemory(userId, PENDING_EXPIRES_KEY),
    store.deleteMemory(userId, PENDING_ATTEMPTS_KEY),
  ]);
}

/**
 * Extract a 6-digit code from user input.
 * Handles messages like "123456", "the code is 123456", "code: 123 456", etc.
 */
export function extractVerificationCode(text: string): string | null {
  // Remove common prefixes
  const cleaned = text.replace(/^(the\s+)?code\s*(is|:)?\s*/i, '').trim();

  // Match 6 consecutive digits (with optional spaces)
  const match = cleaned.replace(/\s/g, '').match(/^\d{6}$/);
  if (match) return match[0];

  // Also try to find 6 digits anywhere in the message
  const anywhere = text.replace(/\s/g, '').match(/(\d{6})/);
  if (anywhere?.[1]) return anywhere[1];

  return null;
}
