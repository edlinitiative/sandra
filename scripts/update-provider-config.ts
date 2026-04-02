import { PrismaClient } from '@prisma/client';

async function main() {
  const db = new PrismaClient();
  const p = await db.connectedProvider.findFirst({ where: { provider: 'google_workspace' } });
  if (!p) { console.log('No provider found'); return; }
  const config = p.config as any;
  config.directoryAdminEmail = 'ted.jacquet@edlight.org';
  await db.connectedProvider.update({ where: { id: p.id }, data: { config } });
  console.log('✅ Updated config:', JSON.stringify(config, null, 2));
  await db.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
