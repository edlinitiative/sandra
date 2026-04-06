/**
 * OTP delivery transports — email (SMTP / nodemailer) and SMS (Twilio REST).
 *
 * Both are env-var gated. If the corresponding env vars aren't set, the
 * transport logs the code instead (useful in development).
 */

import { createLogger } from '@/lib/utils';

const log = createLogger('auth:transports');

// ── Email transport ──────────────────────────────────────────────────────────

/**
 * Send an OTP code via email using nodemailer / SMTP.
 *
 * Required env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */
export async function sendEmailOtp(email: string, code: string): Promise<void> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    log.warn('SMTP not configured — logging OTP code instead', { email, code });
    return;
  }

  // Dynamic import to avoid bundling nodemailer in the client
  const nodemailer = await import('nodemailer');

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: Number(SMTP_PORT ?? 587) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const from = SMTP_FROM ?? SMTP_USER;

  await transporter.sendMail({
    from,
    to: email,
    subject: `Your sign-in code: ${code}`,
    text: [
      `Your verification code is: ${code}`,
      '',
      'This code expires in 10 minutes.',
      'If you did not request this, you can safely ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 24px; text-align: center;">
        <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); margin: 0 auto 24px;" ></div>
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">Your sign-in code</h2>
        <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #6366f1; margin: 24px 0; padding: 16px; background: #f4f3ff; border-radius: 12px;">${code}</div>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.5;">This code expires in 10 minutes.<br/>If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });

  log.info('Email OTP sent', { email });
}

// ── SMS transport ────────────────────────────────────────────────────────────

/**
 * Send an OTP code via SMS using Twilio REST API (no SDK needed).
 *
 * Required env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 */
export async function sendSmsOtp(phone: string, code: string): Promise<void> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    log.warn('Twilio not configured — logging OTP code instead', { phone, code });
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

  const body = new URLSearchParams({
    To: phone,
    From: TWILIO_PHONE_NUMBER,
    Body: `Your sign-in code is: ${code}. It expires in 10 minutes.`,
  });

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    log.error('Failed to send SMS OTP', { phone, status: resp.status, body: text });
    throw new Error(`Twilio SMS failed: ${resp.status}`);
  }

  log.info('SMS OTP sent', { phone });
}
