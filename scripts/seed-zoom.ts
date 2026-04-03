/**
 * Seed Zoom as a ConnectedProvider for EdLight.
 *
 * Run with:
 *   ACCOUNT_ID=xxx CLIENT_ID=yyy CLIENT_SECRET=zzz \
 *   DATABASE_URL=... npx tsx scripts/seed-zoom.ts
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const accountId = process.env.ACCOUNT_ID;
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const hostEmail = process.env.HOST_EMAIL ?? 'ted.jacquet@edlight.org';

  if (!accountId || !clientId || !clientSecret) {
    console.error('❌ Set ACCOUNT_ID, CLIENT_ID, CLIENT_SECRET env vars');
    process.exit(1);
  }

  // Get the EdLight tenant
  const tenant = await db.tenant.findFirst({ where: { slug: 'edlight' } });
  if (!tenant) throw new Error('EdLight tenant not found');

  const provider = await db.connectedProvider.upsert({
    where: { tenantId_provider: { tenantId: tenant.id, provider: 'zoom' } },
    create: {
      tenantId: tenant.id,
      provider: 'zoom',
      label: 'Zoom — EdLight',
      isActive: true,
      credentials: { accountId, clientId, clientSecret },
      config: { defaultHostEmail: hostEmail },
    },
    update: {
      isActive: true,
      credentials: { accountId, clientId, clientSecret },
      config: { defaultHostEmail: hostEmail },
    },
  });

  console.log('✅ Zoom connected:', provider.id);
  console.log('   Host email:', hostEmail);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); })
  .finally(() => db.$disconnect());
