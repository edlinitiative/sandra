# Sandra — AI Agent Platform for the EdLight Ecosystem

<p align="center">
  <strong>Sandra</strong> is the full-stack AI agent platform for EdLight.<br/>
  Multi-channel. Multi-tenant. Fully agentic. Haitian Creole · French · English.
</p>

<p align="center">
  <strong>Status: V6 — Signed off &amp; in production — April 6, 2026</strong><br/>
  Live at <a href="https://sandra.edlight.org">sandra.edlight.org</a> · Voice bridge at <a href="https://voice.edlight.org">voice.edlight.org</a>
</p>

---

## What is Sandra?

Sandra is the central AI agent for the EdLight ecosystem. She handles conversations across every channel, takes autonomous actions through 66 registered tools, and maintains long-term memory per user — all with full multi-tenant isolation.

**Channels (all live)**
- 🌐 **Web chat** — `sandra.edlight.org/chat`
- 📱 **WhatsApp** — inbound/outbound via Meta Cloud API
- 📸 **Instagram** — DM handling via Meta Cloud API
- 📧 **Email** — Gmail polling via domain-wide delegation (every 5 min)
- 🎙️ **Voice** — WebRTC + OpenAI Realtime API; bilingual (Haitian Creole / French / English)

**Integrations (all live)**
- **Google Workspace** — Gmail, Drive, Calendar, Tasks, Forms, Directory (domain-wide delegation)
- **Zoom** — create meetings, list recordings, list users (server-to-server OAuth)
- **Web Search** — Brave Search API with live results

**Platform capabilities**
- 66 tools in the registry; enabled/disabled per tenant at runtime
- Per-user episodic memory with summarization and context injection
- Role-based access control: student / staff / admin / superAdmin
- Full multi-tenant architecture with per-tenant secrets and provider config
- RAG pipeline: 411 indexed docs, 373 vector chunks (pgvector)
- Learning signals: correction detection, capability gap tracking
- Audit log for all sensitive operations
- Automated crons: birthday alerts, email polling, reminder processing

---

## EdLight Ecosystem

Sandra currently indexes and supports these EdLight initiatives:

| Platform | Repository | Description |
|----------|-----------|-------------|
| EdLight Code | [edlinitiative/code](https://github.com/edlinitiative/code) | Core codebase and platform |
| EdLight Academy | [edlinitiative/EdLight-Academy](https://github.com/edlinitiative/EdLight-Academy) | Educational platform and learning resources |
| EdLight News | [edlinitiative/EdLight-News](https://github.com/edlinitiative/EdLight-News) | News and community updates |
| EdLight Initiative | [edlinitiative/EdLight-Initiative](https://github.com/edlinitiative/EdLight-Initiative) | Organization and community hub |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                          Channels                                │
│  Web Chat │ WhatsApp │ Instagram │ Email │ Voice (WebRTC/Bridge) │
└────────────────────────────┬─────────────────────────────────────┘
                             │  channel adapters normalize to InboundMessage
                             ▼
                  ┌─────────────────────┐
                  │    Sandra Agent     │  ReAct loop (reason → tool → respond)
                  │    Orchestrator     │  session memory · user memory · RAG
                  └──────────┬──────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
  ┌──────────┐        ┌──────────┐        ┌──────────────────────┐
  │    AI    │        │Knowledge │        │   Tool Registry      │
  │ Provider │        │  (RAG)   │        │   66 tools           │
  │ (OpenAI) │        │ pgvector │        │  ─────────────────── │
  └──────────┘        └──────────┘        │  Google Workspace    │
                                          │  Zoom                │
                                          │  Web Search          │
                                          │  GitHub              │
                                          │  WhatsApp            │
                                          │  EdLight Knowledge   │
                                          │  Reminders/Tasks     │
                                          │  User/Tenant Mgmt    │
                                          └──────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌────────────┐ ┌───────────┐ ┌─────────────┐
       │   Memory   │ │  Crons    │ │  Auth/RBAC  │
       │  Session   │ │birthdays  │ │  NextAuth   │
       │  User      │ │email-poll │ │  Google OAuth│
       │  (Postgres)│ │reminders  │ │  Tenants    │
       └────────────┘ └───────────┘ └─────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS |
| Database | PostgreSQL (Neon) + Prisma ORM |
| Vector store | pgvector on PostgreSQL |
| AI provider | OpenAI (`gpt-4o`, `text-embedding-3-small`, Realtime API) |
| Auth | NextAuth v5 — Google OAuth + RBAC |
| Voice bridge | Standalone Node.js/WebSocket service (`voice-bridge/`) |
| Deployment | Vercel (app) + separate service (voice bridge) |
| Search | Brave Search API |
| Crons | Vercel cron jobs |

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL with pgvector extension (Neon recommended)
- OpenAI API key

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Configure required variables in .env:
#
#  ── Core (required) ──────────────────────────────────────
#  OPENAI_API_KEY=sk-...              AI completions & embeddings
#  ADMIN_API_KEY=...                  Protects /api/repos, /api/index
#  DATABASE_URL=postgresql://...      Postgres with pgvector
#  NEXTAUTH_SECRET=...                NextAuth session signing
#  NEXTAUTH_URL=http://localhost:3000
#
#  ── Auth ─────────────────────────────────────────────────
#  GOOGLE_CLIENT_ID=...               Google OAuth app
#  GOOGLE_CLIENT_SECRET=...
#
#  ── GitHub indexing (optional) ───────────────────────────
#  GITHUB_TOKEN=ghp_...
#
#  ── Google Workspace (optional) ──────────────────────────
#  GOOGLE_SERVICE_ACCOUNT_EMAIL=...   Service account email
#  GOOGLE_PRIVATE_KEY=...             Service account private key
#  GOOGLE_WORKSPACE_DOMAIN=...        e.g. edlight.org
#
#  ── Zoom (optional) ──────────────────────────────────────
#  ZOOM_ACCOUNT_ID=...
#  ZOOM_CLIENT_ID=...
#  ZOOM_CLIENT_SECRET=...
#
#  ── Brave Search (optional) ──────────────────────────────
#  BRAVE_SEARCH_API_KEY=...
#
#  ── Meta / WhatsApp & Instagram (optional) ───────────────
#  META_APP_SECRET=...
#  META_VERIFY_TOKEN=...
#  WHATSAPP_PHONE_NUMBER_ID=...
#  WHATSAPP_ACCESS_TOKEN=...
#  INSTAGRAM_PAGE_ACCESS_TOKEN=...

# 4. Generate Prisma client and run migrations
npm run db:generate
npm run db:push          # or: npx prisma migrate deploy

# 5. (Optional) Seed tenant data
npx ts-node prisma/seed-tenant.ts

# 6. Start development server
npm run dev
```

### Access

- **Home**: http://localhost:3000
- **Chat**: http://localhost:3000/chat
- **Admin**: http://localhost:3000/admin
- **Health**: http://localhost:3000/api/health

## How the Agent Loop Works

1. User sends a message through any channel (web, WhatsApp, Instagram, email, voice)
2. The channel adapter normalizes it into an `InboundMessage`
3. The agent loads session memory (conversation history) and user memory (long-term facts)
4. The knowledge base is searched via vector similarity for relevant context (RAG)
5. A system prompt is assembled: identity + language + user memory + retrieved docs + tool list
6. The LLM is called with full message history and all 66 tool definitions
7. If the LLM requests tool calls → they are executed → the loop continues
8. The final response is returned to the user through the appropriate channel adapter
9. Messages and any new facts are saved to session/user memory

## Tool Registry

Sandra has **66 tools** organized by domain:

| Domain | Example Tools |
|---|---|
| EdLight Knowledge | `searchKnowledgeBase`, `getInitiatives`, `getCourses`, `getLatestNews`, `getPrograms` |
| Google Workspace | `sendGmail`, `readGmail`, `draftGmail`, `replyGmail`, `searchDrive`, `readDriveFile`, `createGoogleDoc`, `createCalendarEvent`, `listCalendarEvents`, `createTask`, `listTasks`, `getFormResponses`, `listContacts` |
| Zoom | `createZoomMeeting`, `listZoomRecordings` |
| Web Search | `webSearch` |
| WhatsApp | `sendWhatsAppMessage`, `createWhatsAppGroup`, `sendWhatsAppGroupInvite` |
| Memory & User | `saveUserNote`, `listUserNotes`, `forgetUserNote`, `updateUserPreferences`, `getUserProfile` |
| Reminders | `queueReminder`, `listReminders`, `cancelReminder` |
| Tenant & Admin | `manageTenantUsers`, `viewSystemHealth`, `getUsageAnalytics`, `triggerIndexing`, `listConnectedSystems` |
| GitHub | `lookupRepo`, `getGithubPRStatus`, `createGithubIssue` |
| Learning | `getEnrollments`, `getCertificates`, `trackLearningProgress`, `recommendCourses`, `getLearningPath` |
| Applications | `submitApplication`, `getApplicationStatus`, `checkDeadlines`, `submitInterestForm`, `searchScholarships` |
| Documents | `summarizeDocument`, `createSpreadsheet`, `shareDriveFile` |
| Utility | `translateText`, `checkBirthdays`, `getContactInfo`, `draftEmail` |

Tools are enabled/disabled per tenant at runtime via the dynamic tool loader.

## How Indexing Works

1. Repositories are registered in `src/lib/github/config.ts`
2. The indexer fetches README and docs from each repo via GitHub API
3. Content is chunked into overlapping segments
4. Chunks are embedded using OpenAI `text-embedding-3-small`
5. Embedded chunks are stored in pgvector
6. During chat, relevant chunks are retrieved via cosine similarity

Trigger indexing via:
- Admin panel → "Index All Repositories" button
- API: `POST /api/index`

## How to Add New Initiatives

1. Add a new entry to `DEFAULT_REPOS` in `src/lib/github/config.ts`:
   ```typescript
   {
     owner: 'edlinitiative',
     name: 'New-Repo',
     displayName: 'EdLight New Platform',
     description: 'Description of the new platform.',
     url: 'https://github.com/edlinitiative/New-Repo',
     branch: 'main',
     docsPath: 'docs/',
     isActive: true,
   }
   ```
2. Trigger indexing via the admin panel or API
3. Sandra will automatically include the new content in her knowledge base

## API Reference

### Chat

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/chat` | Send a message — returns full JSON response | None |
| `POST` | `/api/chat/stream` | Send a message — returns SSE stream (`start`, `token`, `tool_call`, `done`/`error`) | None |
| `GET` | `/api/conversations/[sessionId]` | Get conversation history for a session | None |

### Channel Webhooks

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/webhooks/whatsapp` | Inbound WhatsApp messages | Meta signature |
| `GET` | `/api/webhooks/whatsapp` | Meta challenge verification | Meta token |
| `POST` | `/api/webhooks/instagram` | Inbound Instagram DMs | Meta signature |
| `GET` | `/api/webhooks/instagram` | Meta challenge verification | Meta token |

### Voice

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/voice/realtime-session` | Mint ephemeral OpenAI Realtime key with Sandra's prompt | None |
| `POST` | `/api/voice/transcribe` | Whisper transcription | None |
| `POST` | `/api/voice/tts` | OpenAI TTS synthesis | None |
| `POST` | `/api/voice/process` | Full voice round-trip (transcribe → agent → TTS) | None |

### Admin & Operations

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/health` | Service health (`db`, `vectorStore`, tool/doc counts) | None |
| `GET` | `/api/repos` | List registered repos with indexing status | API key |
| `POST` | `/api/index` | Trigger repo indexing (`{ repoId?: "owner/repo" }`) | API key |
| `GET` | `/api/cron/daily-birthdays` | Birthday alert cron (`0 10 * * *`) | Vercel |
| `GET` | `/api/cron/email-poll` | Email poll cron (`*/5 * * * *`) | Vercel |
| `GET` | `/api/cron/process-reminders` | Reminder processing cron (`* * * * *`) | Vercel |

Admin endpoints (`/api/repos`, `/api/index`) require an `x-api-key` header matching `ADMIN_API_KEY`.

**Chat request body:**
```json
{
  "message": "What courses are on EdLight Academy?",
  "sessionId": "optional-uuid",
  "userId": "optional-uuid",
  "language": "en",
  "channel": "web"
}
```

## Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── api/                    # API routes
│   │   ├── chat/               # POST /api/chat, /api/chat/stream
│   │   ├── webhooks/           # WhatsApp, Instagram webhooks
│   │   ├── voice/              # Voice endpoints
│   │   ├── cron/               # Scheduled jobs
│   │   ├── repos/              # Repo listing
│   │   ├── index/              # Indexing trigger
│   │   └── health/             # Health check
│   ├── chat/                   # Web chat page
│   ├── admin/                  # Admin dashboard
│   └── layout.tsx
├── components/
│   ├── chat/                   # Chat UI components
│   ├── admin/                  # Admin UI components
│   ├── layout/                 # Layout components
│   └── ui/                     # Base UI primitives
└── lib/                        # Core business logic
    ├── agents/                 # Sandra agent orchestration
    ├── ai/                     # AI provider abstraction (OpenAI)
    ├── analytics/              # Usage analytics
    ├── audit/                  # Audit log
    ├── auth/                   # Auth utilities & session helpers
    ├── channels/               # Channel adapters (web, WhatsApp, Instagram, email, voice)
    ├── connectors/             # External service connectors
    ├── db/                     # Prisma database client
    ├── feedback/               # Thumbs up/down, tool-call feedback
    ├── github/                 # GitHub client, fetcher, indexer
    ├── google/                 # Google Workspace (Gmail, Drive, Calendar, etc.)
    ├── i18n/                   # Multilingual support (EN/FR/HT)
    ├── knowledge/              # RAG pipeline: chunk → embed → store → retrieve
    ├── learning/               # Learning signals, correction detection
    ├── memory/                 # Session memory + user memory
    ├── tools/                  # 66 tools + registry + dynamic loader
    ├── users/                  # User management
    ├── utils/                  # Shared utilities
    └── zoom/                   # Zoom server-to-server OAuth
voice-bridge/                   # Standalone WebSocket relay to OpenAI Realtime
prisma/
    ├── schema.prisma           # Full data model
    └── migrations/             # All applied migrations
```

## Documentation

| Document | Description |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Product requirements and long-range vision |
| [docs/architecture.md](docs/architecture.md) | Full system architecture |
| [docs/agent-system.md](docs/agent-system.md) | Agent loop, tool interface, memory |
| [docs/integrations.md](docs/integrations.md) | All active integrations (channels, Google Workspace, Zoom, Search) |
| [docs/embed.md](docs/embed.md) | **Integration guide for companies embedding Sandra** |
| [docs/roadmap.md](docs/roadmap.md) | Technical delivery roadmap |
| [docs/releases/v5_signoff.md](docs/releases/v5_signoff.md) | V5 signoff — full production verification |

## License

Internal — EdLight Initiative
