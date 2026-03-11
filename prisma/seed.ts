import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed script for Sandra.
 * Populates the RepoRegistry with the default EdLight repositories.
 *
 * Run: npx prisma db seed
 */
async function main() {
  console.log('🌱 Seeding Sandra database...\n');

  // ── Repo Registry ──────────────────────────────────────────────────────────

  const repos = [
    {
      owner: 'edlinitiative',
      name: 'code',
      displayName: 'EdLight Code',
      description: 'The core EdLight codebase and platform.',
      url: 'https://github.com/edlinitiative/code',
      branch: 'main',
      docsPath: 'docs/',
      isActive: true,
    },
    {
      owner: 'edlinitiative',
      name: 'EdLight-News',
      displayName: 'EdLight News',
      description: 'News and updates platform for the EdLight community.',
      url: 'https://github.com/edlinitiative/EdLight-News',
      branch: 'main',
      docsPath: null,
      isActive: true,
    },
    {
      owner: 'edlinitiative',
      name: 'EdLight-Initiative',
      displayName: 'EdLight Initiative',
      description: 'The EdLight Initiative organization and community hub.',
      url: 'https://github.com/edlinitiative/EdLight-Initiative',
      branch: 'main',
      docsPath: null,
      isActive: true,
    },
    {
      owner: 'edlinitiative',
      name: 'EdLight-Academy',
      displayName: 'EdLight Academy',
      description: 'Educational platform and learning resources for the EdLight ecosystem.',
      url: 'https://github.com/edlinitiative/EdLight-Academy',
      branch: 'main',
      docsPath: 'docs/',
      isActive: true,
    },
  ];

  for (const repo of repos) {
    const result = await prisma.repoRegistry.upsert({
      where: { owner_name: { owner: repo.owner, name: repo.name } },
      create: repo,
      update: {
        displayName: repo.displayName,
        description: repo.description,
        url: repo.url,
        branch: repo.branch,
        docsPath: repo.docsPath,
        isActive: repo.isActive,
      },
    });
    console.log(`  ✅ Repo: ${result.displayName} (${result.owner}/${result.name})`);
  }

  // ── Default Admin User (optional) ──────────────────────────────────────────

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@edlight.org' },
    create: {
      name: 'Sandra Admin',
      email: 'admin@edlight.org',
      language: 'en',
      channel: 'web',
    },
    update: {},
  });
  console.log(`  ✅ Admin user: ${adminUser.name} (${adminUser.email})`);

  console.log('\n🌱 Seeding complete!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
