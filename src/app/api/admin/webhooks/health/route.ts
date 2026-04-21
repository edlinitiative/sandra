import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { env } from '@/lib/config';

const PERIOD_HOURS = 24;

type ChannelKey = 'whatsapp' | 'instagram' | 'email';

type ChannelHealth = {
  channel: ChannelKey;
  configured: boolean;
  recentSessions: number | null;
  recentMessages: number | null;
  lastMessageAt: string | null;
  inboundHealth: 'healthy' | 'idle' | 'unconfigured' | 'degraded';
  notes: string[];
};

function isAuthorized(request: Request) {
  const apiKey = request.headers.get('x-api-key');
  return Boolean(apiKey && env.ADMIN_API_KEY && apiKey === env.ADMIN_API_KEY);
}

function getChannelConfig(): Array<{ channel: ChannelKey; configured: boolean; notes: string[] }> {
  return [
    {
      channel: 'whatsapp',
      configured: Boolean(
        env.WHATSAPP_WEBHOOK_SECRET && (env.WHATSAPP_ACCESS_TOKEN || env.BUSINESS_META_TOKEN),
      ),
      notes: [
        env.WHATSAPP_WEBHOOK_SECRET ? 'Webhook secret present' : 'Missing webhook secret',
        env.WHATSAPP_ACCESS_TOKEN || env.BUSINESS_META_TOKEN
          ? 'Access token present'
          : 'Missing access token',
      ],
    },
    {
      channel: 'instagram',
      configured: Boolean(
        (env.INSTAGRAM_PAGE_ACCESS_TOKEN || env.BUSINESS_META_TOKEN)
          && (env.INSTAGRAM_APP_SECRET || env.WHATSAPP_APP_SECRET),
      ),
      notes: [
        env.INSTAGRAM_PAGE_ACCESS_TOKEN || env.BUSINESS_META_TOKEN
          ? 'Page/system-user token present'
          : 'Missing Instagram token',
        env.INSTAGRAM_APP_SECRET || env.WHATSAPP_APP_SECRET
          ? 'App secret present'
          : 'Missing app secret',
      ],
    },
    {
      channel: 'email',
      configured: Boolean(env.SANDRA_EMAIL_ADDRESS || process.env.AGENT_EMAIL_ADDRESS),
      notes: [
        env.SANDRA_EMAIL_ADDRESS || process.env.AGENT_EMAIL_ADDRESS
          ? 'Agent email configured'
          : 'Missing agent email address',
        env.GOOGLE_SA_JSON || (env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_SERVICE_ACCOUNT_KEY)
          ? 'Google service account present'
          : 'Missing Google service account credentials',
      ],
    },
  ];
}

async function getChannelStats(channel: ChannelKey, since: Date): Promise<Pick<ChannelHealth, 'recentSessions' | 'recentMessages' | 'lastMessageAt'>> {
  const [recentSessions, recentMessages, lastInboundMessage] = await Promise.all([
    db.session.count({
      where: {
        channel,
        updatedAt: { gte: since },
      },
    }),
    db.message.count({
      where: {
        role: 'user',
        createdAt: { gte: since },
        session: { channel },
      },
    }),
    db.message.findFirst({
      where: {
        role: 'user',
        session: { channel },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  return {
    recentSessions,
    recentMessages,
    lastMessageAt: lastInboundMessage?.createdAt.toISOString() ?? null,
  };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const since = new Date(Date.now() - PERIOD_HOURS * 60 * 60 * 1000);
  const configuredChannels = getChannelConfig();

  const channels: ChannelHealth[] = await Promise.all(
    configuredChannels.map(async ({ channel, configured, notes }) => {
      try {
        const stats = await getChannelStats(channel, since);
        const recentMessages = stats.recentMessages ?? 0;
        const recentSessions = stats.recentSessions ?? 0;
        const inboundHealth = !configured
          ? 'unconfigured'
          : recentMessages > 0
            ? 'healthy'
            : recentSessions > 0
              ? 'degraded'
              : 'idle';

        return {
          channel,
          configured,
          inboundHealth,
          notes,
          ...stats,
        };
      } catch (error) {
        return {
          channel,
          configured,
          recentSessions: null,
          recentMessages: null,
          lastMessageAt: null,
          inboundHealth: configured ? 'degraded' : 'unconfigured',
          notes: [
            ...notes,
            `Stats unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
          ],
        };
      }
    }),
  );

  const status = channels.every((item) => item.inboundHealth === 'healthy' || item.inboundHealth === 'idle')
    ? 'ok'
    : 'degraded';

  return NextResponse.json({
    status,
    periodHours: PERIOD_HOURS,
    channels,
    checkedAt: new Date().toISOString(),
  });
}
