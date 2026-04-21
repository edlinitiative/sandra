import { logAuditEvent } from '@/lib/audit';

export type WebhookChannel = 'whatsapp' | 'instagram' | 'email';
export type WebhookEventAction =
  | 'webhook_received'
  | 'webhook_processed'
  | 'webhook_failed'
  | 'webhook_skipped'
  | 'webhook_rejected';

interface LogWebhookEventInput {
  channel: WebhookChannel;
  action: WebhookEventAction;
  requestId: string;
  success?: boolean;
  sessionId?: string;
  userId?: string;
  ip?: string;
  details?: Record<string, unknown>;
}

/**
 * Best-effort webhook event logger backed by the AuditLog table.
 */
export async function logWebhookEvent(input: LogWebhookEventInput): Promise<void> {
  await logAuditEvent({
    userId: input.userId,
    sessionId: input.sessionId,
    action: input.action,
    resource: `webhook:${input.channel}`,
    ip: input.ip,
    success: input.success ?? (input.action !== 'webhook_failed' && input.action !== 'webhook_rejected'),
    details: {
      requestId: input.requestId,
      channel: input.channel,
      ...(input.details ?? {}),
    },
  });
}

export function getRequestIp(request: Request): string | undefined {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    undefined
  );
}
