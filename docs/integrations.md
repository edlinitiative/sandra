# Sandra — Integrations

> Last updated: April 6, 2026 — Multi-provider fallback (AI + Voice).
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

### Voice ✅ (Multi-Provider Fallback)
- Live via WebRTC + OpenAI Realtime API
- `POST /api/voice/realtime-session` — mints ephemeral key with Sandra's full system prompt injected
- `POST /api/voice/transcribe` — Speech-to-text (STT)
- `POST /api/voice/speak` — Text-to-speech (TTS)
- `POST /api/voice/process` — full voice round-trip (transcribe → agent → TTS)
- Haitian Creole, French, and English supported
- Voice Bridge (`voice-bridge/`) — standalone Node.js/WebSocket service at `https://voice.edlight.org`; relays WebRTC to OpenAI Realtime

**Voice Provider Abstraction** (`src/lib/channels/voice-providers/`):

Voice STT and TTS now use the same fallback pattern as the AI chat providers.

| Provider | STT | TTS | Voices |
|----------|-----|-----|--------|
| **OpenAI** | Whisper API | `tts-1` API | alloy, echo, fable, onyx, nova, shimmer |
| **Google Gemini** | Multimodal `generateContent` | `gemini-2.5-flash-preview-tts` REST API | Kore, Charon, Aoede, Orus, Leda, Zephyr (mapped from OpenAI names) |

The `FallbackVoiceProvider` tries OpenAI first, then Gemini on retriable errors. Voice mapping:
`alloy→Kore`, `echo→Charon`, `fable→Aoede`, `onyx→Orus`, `nova→Leda`, `shimmer→Zephyr`.

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_TTS_MODEL` | `gemini-2.5-flash-preview-tts` | Gemini TTS model |

Gemini TTS outputs 24kHz 16-bit PCM, auto-wrapped into WAV format.

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

## AI Provider Integration (Multi-Provider Fallback) ✅

Sandra uses a **FallbackProvider** that wraps multiple AI providers and automatically retries with the next provider when a retriable error is detected (quota exhaustion, rate limiting, server errors).

### Provider Chain

Priority order is set via `AI_PROVIDER_PRIORITY` env var (default: `openai,gemini,anthropic`). Only providers with a valid API key are included.

| Provider | Module | Model | Capabilities |
|----------|--------|-------|--------------|
| **OpenAI** ✅ | `src/lib/ai/openai.ts` | `gpt-4o` | Chat, streaming, tools, embeddings (`text-embedding-3-small`) |
| **Google Gemini** ✅ | `src/lib/ai/gemini.ts` | `gemini-2.0-flash` | Chat, streaming, tools |
| **Anthropic** ✅ | `src/lib/ai/anthropic.ts` | `claude-3-5-sonnet-20241022` | Chat, streaming, tools |

### Error Classification

`classifyProviderError()` in `src/lib/ai/fallback.ts` inspects error messages and categorizes them:
- `quota` — billing / usage limit reached
- `rate_limit` — 429 too many requests
- `server` — 500-504 backend errors
- `timeout` — request timed out
- `auth` — 401/403 authentication failure
- `invalid` — malformed request (not retried)
- `unknown` — unrecognized errors

Retriable categories (`quota`, `rate_limit`, `server`, `timeout`) trigger automatic failover to the next provider.

### Embedding Routing

Embeddings are always routed to the first embedding-capable provider in the chain (currently OpenAI's `text-embedding-3-small`), regardless of which chat provider is active.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | — | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI chat model |
| `GEMINI_API_KEY` | — | Google Gemini API key |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini chat/STT model |
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `ANTHROPIC_MODEL` | `claude-3-5-sonnet-20241022` | Anthropic chat model |
| `AI_PROVIDER_PRIORITY` | `openai,gemini,anthropic` | Comma-separated fallback order |

All AI calls go through the `AIProvider` interface in `src/lib/ai/`. The `FallbackProvider` is built automatically at startup by `getAIProvider()` in `src/lib/ai/provider.ts`.

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
