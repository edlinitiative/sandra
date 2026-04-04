import crypto from 'crypto';
import { createLogger } from './logger';

const log = createLogger('utils:webhook-signature');

/**
 * Verify a Meta (WhatsApp / Instagram) webhook payload signature.
 *
 * Meta signs every POST payload with HMAC-SHA256 using the App Secret
 * and sends the signature in the `X-Hub-Signature-256` header as:
 *   sha256=<hex digest>
 *
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
export function verifyMetaSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader) {
    log.warn('Missing X-Hub-Signature-256 header');
    return false;
  }

  if (!appSecret) {
    // If no secret is configured, skip verification (development mode)
    log.warn('No app secret configured — skipping webhook signature verification');
    return true;
  }

  const [algorithm, receivedHash] = signatureHeader.split('=');

  if (algorithm !== 'sha256' || !receivedHash) {
    log.warn('Invalid signature format', { signatureHeader });
    return false;
  }

  const expectedHash = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(receivedHash, 'hex'),
    Buffer.from(expectedHash, 'hex'),
  );

  if (!isValid) {
    log.warn('Webhook signature mismatch');
  }

  return isValid;
}
