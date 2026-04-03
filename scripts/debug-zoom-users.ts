import { PrismaClient } from '@prisma/client';
import { resolveZoomContext } from '../src/lib/zoom/context';
import { getZoomToken } from '../src/lib/zoom/auth';

async function main() {
  const db = new PrismaClient();
  try {
    const p = await db.connectedProvider.findFirst({ where: { provider: 'zoom', isActive: true } });
    if (!p) throw new Error('No Zoom provider found');
    const ctx = await resolveZoomContext(p.tenantId);
    const token = await getZoomToken(ctx.tenantId, ctx.credentials);

    const res = await fetch('https://api.zoom.us/v2/users?page_size=5', {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Body:', text.substring(0, 600));
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => { console.error('❌', e.message); process.exit(1); });
