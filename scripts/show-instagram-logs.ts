import { db } from '../src/lib/db';

async function main() {
  const msgs = await db.message.findMany({
    where: { session: { channel: 'instagram' } },
    include: { session: { select: { channel: true, createdAt: true } } },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\nTotal Instagram messages: ${msgs.length}\n`);

  for (const m of msgs) {
    const ts = m.createdAt.toISOString().replace('T', ' ').slice(0, 19);
    console.log(`--- [${ts}] ${m.role.toUpperCase()} ---`);
    console.log(m.content.slice(0, 800));
    console.log();
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
