import { PrismaClient } from '@prisma/client';
import { resolveZoomContext } from '../src/lib/zoom/context';
import { getZoomToken } from '../src/lib/zoom/auth';
import { createZoomMeeting } from '../src/lib/zoom/meetings';

async function main() {
  const db = new PrismaClient();
  try {
    const provider = await db.connectedProvider.findFirst({
      where: { provider: 'zoom', isActive: true },
    });
    if (!provider) throw new Error('No Zoom provider found');
    console.log('Provider ID:', provider.id);

    const ctx = await resolveZoomContext(provider.tenantId);

    // Test token
    const token = await getZoomToken(ctx.tenantId, ctx.credentials);
    console.log('✅ Zoom token obtained:', token.substring(0, 20) + '...');

    // Test meeting creation
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const isoStart = tomorrow.toISOString().replace('.000Z', '');

    const result = await createZoomMeeting(ctx, {
      topic: 'Sandra test meeting — delete me',
      startDateTime: isoStart,
      durationMinutes: 30,
      timeZone: 'America/New_York',
    });

    console.log('✅ Zoom meeting created:');
    console.log('   Meeting ID:', result.meetingId);
    console.log('   Join URL:', result.joinUrl);
    console.log('   Passcode:', result.password);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
