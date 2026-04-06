# Sandra — Integrations

> Last updated: April 5, 2026 — V5 production release.
> All integrations listed here are live and verified in production unless otherwise noted.

---

## GitHub Integration

### Architecture

```
Repository Registry (config)
        │
        ▼
GitHub Client (API)
        │
        ▼
Fetcher (traverse repo, download files)
        │
        ▼
Indexer (chunk → embed → store)
        │
        ▼
pgvector (cosine similarity retrieval)
```

### Repository Registry
Repos are registered in `src/lib/github/config.ts`. Each entry specifies:
- Owner and repo name
- Display name and description
- Branch to index
- Docs path (optional)
- Active status

### GitHub Client
Low-level API client (`src/lib/github/client.ts`) that handles:
- Authentication via `GITHUB_TOKEN`
- Directory listing
- File content fetching (base64 decode)
- README fetching
- Repository metadata

### Fetcher
The fetcher (`src/lib/github/fetcher.ts`) recursively traverses repos:
- Fetches README first
- Traverses docs directories
- Fetches top-level markdown files
- Filters by file extension and size
- Deduplicates results

Indexable extensions: `.md`, `.mdx`, `.txt`, `.rst`, `.json`, `.yaml`, `.yml`, `.toml`, `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, and more.

### Indexer
The indexer (`src/lib/github/indexer.ts`) orchestrates the full pipeline:
1. Fetch all indexable files from a repo
2. Convert to `RawDocument` format
3. Remove old indexed content for the source
4. Run through the ingest pipeline (chunk → embed → store)

### Triggering Indexing
- **Manual**: Admin panel button or `POST /api/index`
- **Targeted**: `POST /api/index` with `{ "repoId": "owner/repo" }`

---

## Channel Integrations

### Web Chat ✅
Fully live. Messages flow through the web channel adapter which normalizes form data into `InboundMessage` format. Available at `https://sandra.edlight.org/chat`.

### WhatsApp ✅
- Live via Meta WhatsApp Business Cloud API
- Webhook: `POST /api/webhooks/whatsapp` (inbound), `GET /api/webhooks/whatsapp` (challenge)
- Outbound: `sendWhatsAppMessage` tool via the WhatsApp Cloud API
- Group support: `createWhatsAppGroup`, `sendWhatsAppGroupInvite`
- Channel identity maps WhatsApp numbers to user accounts for cross-channel continuity
- **Pending**: one-time Meta Developer Console webhook registration for production URL

### Instagram ✅
- Live via Meta Instagram Messaging API
- Webhook: `POST /api/webhooks/instagram` (inbound DMs), `GET /api/webhooks/instagram` (challenge)
- Same identity and continuity model as WhatsApp
- **Pending**: Meta Developer Console webhook registration (same as WhatsApp)

### Email ✅
- Live via Gmail domain-wide delegation
- Polls for new messages every 5 minutes via `GET /api/cron/email-poll`
- Outbound: `sendGmail`, `draftGmail`, `replyGmail` tools
- Inbound messages are processed as agent conversations and replied to via Gmail API

### Voice ✅
- Live via WebRTC + OpenAI Realtime API
- `POST /api/voice/realtime-session` — mints ephemeral key with Sandra's full system prompt injected
- `POST /api/voice/transcribe` — Whisper-based transcription
- `POST /api/voice/tts` — OpenAI TTS synthesis
- `POST /api/voice/process` — full voice round-trip (transcribe → agent → TTS)
- Haitian Creole, French, and English supported
- Voice Bridge (`voice-bridge/`) — standalone Node.js/WebSocket service at `https://voice.edlight.org`; relays WebRTC to OpenAI Realtime

---

## Google Workspace Integration ✅

Domain-wide delegation via a Google service account. Required env vars: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_WORKSPACE_DOMAIN`.

Implemented in `src/lib/google/`.

| Scope | Tools |
|---|---|
| Gmail | `sendGmail`, `readGmail`, `draftGmail`, `replyGmail` |
| Google Drive | `searchDrive`, `readDriveFile`, `createGoogleDoc`, `createSpreadsheet`, `shareDriveFile` |
| Google Calendar | `createCalendarEvent`, `listCalendarEvents`, `updateCalendarEvent`, `deleteCalendarEvent` |
| Google Tasks | `createTask`, `listTasks` |
| Google Forms | `createGoogleForm`, `getFormResponses` |
| Google Directory | `listContacts`, `getContactInfo` |

Per-tenant Google Workspace service accounts are supported — each tenant can have its own `serviceAccountEmail` and delegated credentials stored via the tenant provider config.

---

## Zoom Integration ✅

Server-to-server OAuth. Required env vars: `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`.

Implemented in `src/lib/zoom/`.

| Tool | Description |
|---|---|
| `createZoomMeeting` | Schedule and create a Zoom meeting; returns join URL and meeting ID |
| `listZoomRecordings` | List cloud recordings for a user |

Per-tenant Zoom credentials are supported via the tenant provider config.

---

## Web Search Integration ✅

Brave Search API. Required env var: `BRAVE_SEARCH_API_KEY`.

| Tool | Description |
|---|---|
| `webSearch` | Live web search; returns top results with titles, URLs, and snippets. Gracefully handles unsupported country codes. |

---

## AI Provider Integration

### Current: OpenAI ✅
- Chat completions via `gpt-4o` (configurable via `OPENAI_MODEL`)
- Embeddings via `text-embedding-3-small` (configurable via `OPENAI_EMBEDDING_MODEL`)
- Realtime API for voice sessions
- Tool/function calling with full 66-tool support

All AI calls go through the `AIProvider` interface in `src/lib/ai/`. The interface is provider-agnostic; swapping to Anthropic or Google Gemini requires only a new implementation of that interface.

---

## Multi-Tenant Architecture ✅

Sandra supports full multi-tenant isolation:
- Each tenant has its own `Tenant` record with name, slug, and config
- Per-tenant tool enablement via `TenantToolConfig` — tools can be enabled or disabled per tenant at runtime
- Per-tenant provider credentials (Google Workspace, Zoom) stored as `TenantProviderConfig`
- Per-tenant API keys (`TenantApiKey`) for programmatic access
- Tenant context is resolved on every request and passed through the agent pipeline

Tenant management is available via the admin dashboard and `manageTenantUsers` tool.

---

## Automated Crons ✅

| Job | Endpoint | Schedule | Description |
|---|---|---|---|
| Birthday alerts | `GET /api/cron/daily-birthdays` | `0 10 * * *` | Looks up contacts in Google Sheets and sends WhatsApp birthday messages |
| Email polling | `GET /api/cron/email-poll` | `*/5 * * * *` | Fetches new Gmail messages and processes them as agent conversations |
| Reminder processing | `GET /api/cron/process-reminders` | `* * * * *` | Dispatches due reminders to users |

Configured in `vercel.json`.

- Implement `AIProvider` interface with Gemini API
- Swap via configuration

## Vector Store Integration

### Current: In-Memory
- Brute-force cosine similarity search
- Suitable for development and small datasets
- No persistence across restarts

### Future Options
| Provider | Pros | Cons |
|----------|------|------|
| pgvector | Uses existing PostgreSQL | Scale limits |
| Pinecone | Managed, easy scaling | Cost, vendor lock-in |
| Qdrant | Open source, performant | Self-hosted complexity |
| Weaviate | Full-featured | Heavier setup |

Migration path: Implement the `VectorStore` interface for the chosen provider and update `getVectorStore()` to return the new implementation.

## Database Integration

### Current: Prisma + PostgreSQL
Schema defined in `prisma/schema.prisma`. Tables:
- `User`, `Session`, `Message` — Conversation data
- `Memory` — Long-term user facts
- `IndexedSource`, `IndexedDocument` — Knowledge base
- `RepoRegistry` — GitHub repo tracking

### Connection
Via `DATABASE_URL` environment variable. Prisma client is a singleton with hot-reload protection.
