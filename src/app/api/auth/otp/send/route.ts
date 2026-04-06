/**
 * POST /api/auth/otp/send
 *
 * Sends a one-time passcode to the given email or phone number.
 * Rate-limited to 1 code per identifier per 60 seconds.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createOtp } from '@/lib/auth/otp';
import { sendEmailOtp, sendSmsOtp } from '@/lib/auth/transports';
import { createLogger } from '@/lib/utils';

const log = createLogger('api:auth:otp:send');

const sendSchema = z.object({
  identifier: z.string().min(1).max(320),
  type: z.enum(['email', 'phone']),
});

// Simple in-memory rate limit: 1 send per identifier per 60s
const lastSent = new Map<string, number>();
const RATE_LIMIT_MS = 60_000;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = sendSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { identifier, type } = parsed.data;
    const key = `${type}:${identifier.toLowerCase().trim()}`;

    // Rate limit
    const last = lastSent.get(key);
    if (last && Date.now() - last < RATE_LIMIT_MS) {
      const retryAfter = Math.ceil((RATE_LIMIT_MS - (Date.now() - last)) / 1000);
      return NextResponse.json(
        { error: 'Too many requests. Try again shortly.', retryAfter },
        { status: 429 },
      );
    }

    // Validate identifier format
    if (type === 'email') {
      const emailResult = z.string().email().safeParse(identifier);
      if (!emailResult.success) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
      }
    } else {
      // Basic E.164 phone validation
      const phoneRegex = /^\+[1-9]\d{6,14}$/;
      if (!phoneRegex.test(identifier.trim())) {
        return NextResponse.json(
          { error: 'Invalid phone number. Use E.164 format (e.g. +1234567890).' },
          { status: 400 },
        );
      }
    }

    // Generate and store OTP
    const code = await createOtp(identifier, type);

    // Send via appropriate transport
    if (type === 'email') {
      await sendEmailOtp(identifier, code);
    } else {
      await sendSmsOtp(identifier, code);
    }

    lastSent.set(key, Date.now());

    log.info('OTP sent', { type, identifier: identifier.replace(/.(?=.{3})/g, '*') });

    return NextResponse.json({ sent: true });
  } catch (error) {
    log.error('Failed to send OTP', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Failed to send code' }, { status: 500 });
  }
}
