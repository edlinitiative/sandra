import { PrismaClient } from '@prisma/client';
import { resolveGoogleContext } from '../src/lib/google/context';
import { createTask } from '../src/lib/google/tasks';

async function main() {
  const db = new PrismaClient();
  try {
    const provider = await db.connectedProvider.findFirst({
      where: { provider: 'google_workspace', isActive: true },
    });
    const tenantId = provider!.tenantId;
    console.log('Tenant:', tenantId);

    const ctx = await resolveGoogleContext(tenantId, 'ted.jacquet@edlight.org');
    const result = await createTask(ctx, {
      title: 'Sandra test task — delete me',
      notes: 'Automated test from Sandra to verify Tasks API DWD scope',
      dueDate: '2026-04-10',
    });

    console.log('✅ Task created:', JSON.stringify(result, null, 2));
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => { console.error('❌', err.message); process.exit(1); });
