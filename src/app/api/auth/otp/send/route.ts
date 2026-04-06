/**
 * POST /api/auth/otp/send
 *
 * Sends a one-time passcode to the given email address.
 * Phone auth is handled client-side via Firebase Authentication.
 * Rate-limited to 1 code per identifier per 60 seconds.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createOtp } from '@/lib/auth/otp';
import { sendEmailOtp } from '@/lib/auth/transports';
import { createLogger } from '@/lib/utils';

const log = createLogger('api:auth:otp:send');

const sendSchema = z.object({
  identifier: z.string().email().max(320),
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
        { error: 'Invalid email address', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { identifier } = parsed.data;
    const key = `email:${identifier.toLowerCase().trim()}`;

    // Rate limit
    const last = lastSent.get(key);
    if (last && Date.now() - last < RATE_LIMIT_MS) {
      const retryAfter = Math.ceil((RATE_LIMIT_MS - (Date.now() - last)) / 1000);
      return NextResponse.json(
        { error: 'Too many requests. Try again shortly.', retryAfter },
        { status: 429 },
      );
    }

    // Generate and store OTP
    const code = await createOtp(identifier, 'email');

    // Send via email
    await sendEmailOtp(identifier, code);

    lastSent.set(key, Date.now());

    log.info('OTP sent', { identifier: identifier.replace(/.(?=.{3})/g, '*') });

    return NextResponse.json({ sent: true });
  } catch (error) {
    log.error('Failed to send OTP', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Failed to send code' }, { status: 500 });
  }
}
