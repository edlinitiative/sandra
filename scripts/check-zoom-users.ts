import { PrismaClient } from '@prisma/client';
import { resolveZoomContext } from '../src/lib/zoom/context';
import { getZoomToken } from '../src/lib/zoom/auth';
import { createZoomMeeting } from '../src/lib/zoom/meetings';

const TEST_EMAILS = [
  'ted.jacquet@edlight.org',
  'sandra@edlight.org',
];

async function main() {
  const db = new PrismaClient();
  try {
    const p = await db.connectedProvider.findFirst({ where: { provider: 'zoom', isActive: true } });
    if (!p) throw new Error('No Zoom provider found');
    const ctx = await resolveZoomContext(p.tenantId);
    const token = await getZoomToken(ctx.tenantId, ctx.credentials);

    // Try listing users (needs user:read:list_users:admin scope)
    const listRes = await fetch('https://api.zoom.us/v2/users?page_size=20&status=active', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (listRes.ok) {
      const data = await listRes.json() as {
        users?: Array<{ email: string; first_name: string; last_name: string; type: number; status: string }>;
        total_records?: number;
      };
      console.log(`\nZoom users (${data.total_records ?? 0} total):`);
      data.users?.forEach((u) => {
        const tier = u.type === 2 ? 'Licensed' : u.type === 3 ? 'Pro' : 'Basic';
        console.log(` ✅ ${u.email} | ${u.first_name} ${u.last_name} | ${tier} | ${u.status}`);
      });
    } else {
      const err = await listRes.json() as { message: string };
      console.log(`\n⚠️  Can't list users: ${err.message}`);
      console.log('   → Add scope "user:read:list_users:admin" to your Zoom Server-to-Server app\n');
    }

    // Test meeting creation for each email
    console.log('\nTesting meeting creation per host:');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const isoStart = tomorrow.toISOString().slice(0, 19);

    for (const email of TEST_EMAILS) {
      try {
        const result = await createZoomMeeting(ctx, {
          topic: `Test — ${email}`,
          startDateTime: isoStart,
          durationMinutes: 30,
          timeZone: 'America/New_York',
          hostEmail: email,
        });
        console.log(` ✅ ${email} → meeting ${result.meetingId} | ${result.joinUrl}`);

        // Clean up
        await fetch(`https://api.zoom.us/v2/meetings/${result.meetingId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(` ❌ ${email} → ${msg}`);
      }
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
