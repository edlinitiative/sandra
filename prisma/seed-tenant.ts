/**
 * Seed script: Create EdLight as tenant zero with Google Workspace provider.
 * Run: DATABASE_URL="..." npx tsx prisma/seed-tenant.ts
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const db = new PrismaClient();

async function main() {
  console.log('🌱 Seeding EdLight tenant...');

  // Read service account JSON from disk
  const saPath = resolve(__dirname, '..', 'sandra_ai_service_acccount_json');
  const saJson = JSON.parse(readFileSync(saPath, 'utf-8'));
  console.log(`📄 Loaded service account: ${saJson.client_email}`);

  // 1. Create EdLight tenant (tenant zero)
  const tenant = await db.tenant.upsert({
    where: { slug: 'edlight' },
    create: {
      name: 'EdLight',
      slug: 'edlight',
      domain: 'edlight.org',
      isActive: true,
      metadata: { plan: 'internal', tier: 'tenant_zero' },
    },
    update: {
      name: 'EdLight',
      domain: 'edlight.org',
      isActive: true,
    },
  });
  console.log(`✅ Tenant created: ${tenant.id} (${tenant.slug})`);

  // 2. Create Google Workspace connected provider
  const credentials = {
    type: 'service_account',
    client_email: saJson.client_email,
    private_key: saJson.private_key,
    project_id: saJson.project_id,
    token_uri: saJson.token_uri,
    client_id: saJson.client_id,
  };

  const config = {
    domain: 'edlight.org',
    adminEmail: 'sandra@edlight.org',
    grantedScopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/admin.directory.user.readonly',
    ],
    driveFolderIds: [], // Add folder IDs later
  };

  const provider = await db.connectedProvider.upsert({
    where: { tenantId_provider: { tenantId: tenant.id, provider: 'google_workspace' } },
    create: {
      tenantId: tenant.id,
      provider: 'google_workspace',
      label: 'Google Workspace — EdLight',
      credentials: credentials as any,
      config: config as any,
      isActive: true,
    },
    update: {
      credentials: credentials as any,
      config: config as any,
      label: 'Google Workspace — EdLight',
      isActive: true,
    },
  });
  console.log(`✅ Provider created: ${provider.id} (google_workspace)`);

  // 3. Link existing admin users as tenant members
  const adminUsers = await db.user.findMany({
    where: {
      OR: [
        { email: { contains: '@edlight.org' } },
        { role: 'admin' },
      ],
    },
    select: { id: true, email: true, role: true },
  });

  for (const user of adminUsers) {
    const tenantRole = user.role === 'admin' ? 'admin' : 'basic';
    await db.tenantMember.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
      create: {
        tenantId: tenant.id,
        userId: user.id,
        role: tenantRole as any,
        isActive: true,
      },
      update: {
        role: tenantRole as any,
        isActive: true,
      },
    });
    console.log(`  👤 Linked user ${user.email ?? user.id} as ${tenantRole}`);
  }

  console.log('\n🎉 Done! EdLight is tenant zero.');
  console.log(`   Tenant ID: ${tenant.id}`);
  console.log(`   Provider ID: ${provider.id}`);
  console.log(`   Members linked: ${adminUsers.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
