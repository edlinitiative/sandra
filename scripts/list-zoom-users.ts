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

    const res = await fetch('https://api.zoom.us/v2/users?page_size=20&status=active', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json() as {
      users?: Array<{ email: string; first_name: string; last_name: string; type: number }>;
    };

    console.log('Zoom users in your account:');
    data.users?.forEach((u) => {
      const tier = u.type === 2 ? 'Licensed' : u.type === 3 ? 'Pro' : 'Basic';
      console.log(` - ${u.email} | ${u.first_name} ${u.last_name} | ${tier}`);
    });
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
