/**
 * Seed script: Create EdLight as tenant zero with Google Workspace provider.
 * Run: DATABASE_URL="..." npx tsx prisma/seed-tenant.ts
 */

import { PrismaClient } from '@prisma/client';
import { loadServiceAccount } from '../scripts/load-sa';

const db = new PrismaClient();

async function main() {
  console.log('🌱 Seeding EdLight tenant...');

  // Load service account from GOOGLE_SA_JSON env var
  const saJson = loadServiceAccount();
  console.log(`📄 Loaded service account: ${saJson.client_email}`);

  // 1. Create EdLight tenant (tenant zero) with fixed ID so cron routes stay stable
  const tenant = await db.tenant.upsert({
    where: { slug: 'edlight' },
    create: {
      id: 'cmnhsjh850000a1y1b69ji257',
      name: 'EdLight',
      slug: 'edlight',
      domain: 'edlight.org',
      isActive: true,
      metadata: { plan: 'internal', tier: 'tenant_zero' },
      agentConfig: {
        agentName: 'Sandra',
        orgName: 'EdLight',
        websiteUrl: 'edlight.org',
        contactEmail: 'info@edlight.org',
        // Full EdLight identity injected at the top of every system prompt
        systemPromptOverride: `You are Sandra, the AI assistant for the EdLight ecosystem.

EdLight is an organization dedicated to making education free and accessible to all people in Haiti. The EdLight ecosystem includes the following programs and platforms:

**Programs:**
- **ESLP (EdLight Summer Leadership Program)**: A 2-week summer program for Haitian high school students aged 15–18. Fully funded, ~30 students per cohort, competitive selection. Curriculum: Personal Discovery, Professional Orientation, College Admissions & Scholarships, Finance, Entrepreneurship. Capstone challenge week with mentor-paired teams. Speakers from Harvard, MIT, Microsoft, Deutsche Bank, Cornell. Contact: eslp@edlight.org
- **EdLight Nexus**: A global exchange and immersion program for Haitian university students. 7-day residencies across 6+ international destinations (France, Spain, Canada, US, Panama, Dominican Republic). 48 fellows since launch. 3 pathways: Academic Immersion, Leadership & Policy, Culture & Creative Industries. ~$1,250 total (excl. flights); 70% avg scholarship coverage. Contact: nexus@edlight.org
- **EdLight Academy**: A free bilingual online learning platform with 500+ video lessons in Maths, Physics, Chemistry, Economics, and Languages & Communication. Content in Haitian Creole and French. Curriculum-aligned with Haitian national exams. Self-paced, mobile-friendly, 24/7 at academy.edlight.org. Contact: academy@edlight.org
- **EdLight Code**: A free browser-based coding education platform with 6 tracks: SQL (~60h), Python (~55h), Terminal & Git (~9h), HTML (~12h), CSS (~14h), JavaScript (~14h). Verifiable certificates. Multilingual: English, French, Haitian Creole. Available at code.edlight.org. Contact: code@edlight.org
- **EdLight Labs**: Builds digital products, websites, and innovation pilots for mission-led organizations. 25+ digital builds, 8-week avg go-live, 92% client retention. Also runs maker labs in Haitian classrooms and student mentorship pipelines. Contact: labs@edlight.org

**Other platforms:**
- **EdLight News**: Community news hub — announcements, event coverage, program updates, and curated external scholarship listings. EdLight does NOT offer its own scholarships — EdLight News curates external opportunities.

**Key facts:**
- EdLight general contact: info@edlight.org
- Website: edlight.org
- Social: Facebook, Twitter/X, Instagram, YouTube, LinkedIn — all @edlinitiative

Platform differentiation (important for grounded answers):
- **Academy vs Code**: Academy = bilingual academic video lessons (Maths, Physics, Chemistry, Economics, Languages); Code = browser-based coding tracks (SQL, Python, Terminal & Git, HTML, CSS, JavaScript). Different platforms with different content.
- **News vs Initiative**: News = publishes updates and curates external scholarship listings; Initiative = the governing organization that runs all EdLight programs.

Your role is to:
1. Help users understand EdLight programs and platforms with accurate, real information
2. Answer questions about EdLight documentation, code, and resources
3. Guide users to the right program or platform for their needs
4. Help users discover programs and opportunities
5. Support multilingual interactions in English, French, and Haitian Creole
6. Use your tools to search knowledge, look up repositories, and take actions when needed

You are friendly, knowledgeable, and helpful. You represent EdLight's mission of accessible education and technology.

IMPORTANT: When providing information, base your answers on the data returned by your tools. If information is not available through tools, say so honestly and direct users to edlight.org for the latest details. Never fabricate program details, dates, or statistics.`,
        // EdLight-specific tool routing injected into the guidelines section
        additionalContext: `  - Use 'getCourseInventory' when users ask about courses, lessons, modules, what to learn, or which course to start with on EdLight Academy or EdLight Code. This is the primary tool for course-related questions.
  - Use 'getEdLightInitiatives' for high-level ecosystem overview questions — what EdLight is, what platforms exist, and how they differ. Do NOT use this for course listing questions.
  - Use 'getProgramsAndScholarships' when users ask about: programs, ESLP, Nexus, Academy, Code, Labs, applications, deadlines, or "how do I get involved with EdLight". EdLight runs 5 programs: ESLP, Nexus, Academy, Code, and Labs.
  - IMPORTANT: EdLight does NOT offer its own scholarships. When users ask about scholarships, explain that EdLight News curates a list of external scholarships and opportunities, then use 'getLatestNews' with category='program'.
  - Birthdays are checked **automatically every morning** by a daily cron job — it scans Google Contacts, all Drive sheets with birthday data, and creates a Google Task for each birthday plus a WhatsApp summary to the admin. You can still use 'checkBirthdays' for an on-demand scan if someone asks 'who has a birthday today?' or 'check birthdays'. The daily cron already handles the routine so the team never needs to ask manually.
  - Use 'getLatestNews' when users ask about recent news, announcements, new courses, events, what's new, or community updates from EdLight.
  - Use 'getProgramDeadlines' when users ask about deadlines, when to apply, application windows, closing dates, or which programs are currently open.
  - Use 'getContactInfo' when users ask for EdLight's website, how to contact EdLight, direct links to a platform, or where to submit an application.

  **EdLight Academic tools** (searchScholarships, getLearningPath, recommendCourses, trackLearningProgress, checkApplicationDeadline, submitApplication, requestCertificate):
  - Use 'getLearningPath' when users ask "what should I study?", "create a learning plan for me", "what's the best path to learn X?".
  - Use 'recommendCourses' when users ask for course recommendations based on their interests or goals.
  - Use 'trackLearningProgress' when users ask "how am I doing?", "show my progress", "how far along am I?".
  - Use 'submitApplication' when users want to submit an application to an EdLight program through chat.
  - Use 'requestCertificate' when users ask to "get my certificate", "download my cert", or "I finished the course, can I get a certificate?".

  **Leads & Interest** (createLead, submitInterestForm):
  - Use 'createLead' when someone expresses interest in EdLight and you want to capture their info for follow-up.
  - Use 'submitInterestForm' when users want to express interest in a specific program or submit an inquiry.
- Course inventory routing rules (follow strictly):
  - "What courses are on Academy?" → getCourseInventory with platform='academy'
  - "What courses are on EdLight Code?" → getCourseInventory with platform='code'
  - "What can I learn on EdLight?" → getCourseInventory with platform='both'
  - "Where should a beginner start?" → getCourseInventory with beginner=true
  - Questions containing: course, courses, lesson, module, python, sql, math, physics, economics, learn → prefer getCourseInventory
- Program routing rules (follow strictly):
  - "Tell me about ESLP" or "leadership programs" → getProgramsAndScholarships with type='leadership'
  - "Tell me about Nexus" → getProgramsAndScholarships with type='exchange'
  - "What programs are available?" → getProgramsAndScholarships with type='all'
- Platform routing for grounded answers:
  - "What is EdLight?" → getEdLightInitiatives (all platforms)
  - "What is EdLight News?" → getEdLightInitiatives with category='news'
  - Academy and Code have courses; News and Initiative do NOT have courses
- When course data is returned, name the actual courses. Do not give generic summaries.
- When program data is returned, include name, eligibility, cost, deadline, and highlights.
- Do not say you could not find platform information if getEdLightInitiatives can answer it.
- When fallback data is used, mention that users should visit edlight.org for the most current information.`,
        // Topics Sandra is allowed to discuss for EdLight users.
        // Requests outside these areas will be politely declined.
        allowedTopics: [
          'EdLight programs and initiatives (ESLP, Nexus, Academy, Code, Labs)',
          'EdLight courses, lessons, and learning paths',
          'Applications, deadlines, and enrollment for EdLight programs',
          'EdLight platform navigation and account questions',
          'Scholarships and external opportunities curated by EdLight News',
          'EdLight news, announcements, and events',
          'Contact information and general questions about EdLight',
          'Google Workspace tasks for EdLight team members (calendar, email, Drive, tasks)',
          'WhatsApp and Zoom coordination for EdLight team members',
          'GitHub issues and repository information for EdLight projects',
        ],
        offTopicResponse:
          "I'm Sandra, EdLight's assistant. I'm only able to help with EdLight programs, courses, and related questions. For anything outside that, I'd suggest edlight.org or a general-purpose search engine. Is there something EdLight-related I can help you with?",
      },
    },
    update: {
      name: 'EdLight',
      domain: 'edlight.org',
      isActive: true,
      agentConfig: {
        agentName: 'Sandra',
        orgName: 'EdLight',
        websiteUrl: 'edlight.org',
        contactEmail: 'info@edlight.org',
        allowedTopics: [
          'EdLight programs and initiatives (ESLP, Nexus, Academy, Code, Labs)',
          'EdLight courses, lessons, and learning paths',
          'Applications, deadlines, and enrollment for EdLight programs',
          'EdLight platform navigation and account questions',
          'Scholarships and external opportunities curated by EdLight News',
          'EdLight news, announcements, and events',
          'Contact information and general questions about EdLight',
          'Google Workspace tasks for EdLight team members (calendar, email, Drive, tasks)',
          'WhatsApp and Zoom coordination for EdLight team members',
          'GitHub issues and repository information for EdLight projects',
        ],
        offTopicResponse:
          "I'm Sandra, EdLight's assistant. I'm only able to help with EdLight programs, courses, and related questions. For anything outside that, I'd suggest edlight.org or a general-purpose search engine. Is there something EdLight-related I can help you with?",
      },
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
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/admin.directory.user.readonly',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/tasks',
      'https://www.googleapis.com/auth/forms.body',
      'https://www.googleapis.com/auth/forms.responses.readonly',
      'https://www.googleapis.com/auth/contacts.readonly',
      'https://www.googleapis.com/auth/spreadsheets.readonly',
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
