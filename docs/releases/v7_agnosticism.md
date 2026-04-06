# Sandra V7 — Pure Platform Agnosticism

**Version**: 0.3.0  
**Status**: Planning  
**Date**: April 6, 2026  
**Prerequisite**: V6 signed off  
**Goal**: Make Sandra a truly agnostic multi-tenant AI agent platform — no assumptions about provider, channel, tenant, or integration.

---

## Why This Release Exists

A full platform audit on April 6, 2026 revealed that while Sandra's **architecture aspires to be agnostic** (the interfaces and abstractions exist), the **implementation leaks in critical ways** across four dimensions:

| Dimension | Current Grade | Target Grade |
|-----------|:------------:|:------------:|
| AI Provider | C+ | A |
| Multi-Tenant Isolation | D | A |
| Channel | B+ | A |
| Integration | C- | A |

**11 critical issues** were identified. Sandra is not production-safe for multi-tenant deployment in its current state. V7 fixes this.

---

## Scope

V7 is exclusively focused on **agnosticism and isolation**. No new features, no new channels, no new tools. Every task in this release exists to close a gap between what the architecture promises and what the code delivers.

---

# Phase 1 — Multi-Tenant Data Isolation (Critical)

> **Priority: P0 — Must ship first. Everything else depends on this.**

The most severe gap. 17 of 22 data models lack a `tenantId` column. There is no tenant resolution in middleware. Multiple API routes are unauthenticated. Knowledge retrieval crosses tenant boundaries.

### Task 1.1 — Add `tenantId` to all core models

Add a required `tenantId` foreign key column to every model that currently lacks one:

| Model | Current State | Action |
|-------|:------------:|--------|
| `User` | ❌ No tenantId | Users are multi-tenant members — no change needed (correct by design) |
| `ChatSession` | ❌ No tenantId | **Add `tenantId`**, backfill from session context |
| `Message` | ❌ No tenantId | **Add `tenantId`**, backfill from parent session |
| `Memory` | ❌ No tenantId | **Add `tenantId`**, backfill from userId→TenantMember |
| `IndexedDocument` | ❌ No tenantId | **Add `tenantId`**, backfill (all current docs belong to EdLight) |
| `KnowledgeSource` | ❌ No tenantId | **Add `tenantId`** |
| `GithubRepo` | ❌ No tenantId | **Add `tenantId`** |
| `Enrollment` | ❌ No tenantId | **Add `tenantId`** |
| `Certificate` | ❌ No tenantId | **Add `tenantId`** |
| `Application` | ❌ No tenantId | **Add `tenantId`** |
| `AuditLog` | ❌ No tenantId | **Add `tenantId`** |
| `ActionRequest` | ❌ No tenantId | **Add `tenantId`** |
| `ChannelIdentity` | ❌ No tenantId | **Add `tenantId`** |
| `MessageFeedback` | ❌ No tenantId | **Add `tenantId`** |
| `AnalyticsEvent` | ❌ No tenantId | **Add `tenantId`** |
| `KnowledgeCorrection` | ❌ No tenantId | **Add `tenantId`** |
| `CapabilityGap` | ❌ No tenantId | **Add `tenantId`** |

**Deliverables**:
- Prisma migration adding `tenantId` (nullable initially for backfill, then required)
- Backfill script that assigns existing data to the EdLight tenant
- `@@index([tenantId])` on every updated model
- Second migration making `tenantId` required

**Files**: `prisma/schema.prisma`, new migration, backfill script

---

### Task 1.2 — Add tenant resolution to middleware

The Next.js middleware (`src/middleware.ts`) currently handles only CORS and rate limiting. It performs **zero tenant resolution**.

**Requirements**:
- Extract tenant from one of: subdomain, `X-Tenant-ID` header, JWT claim, or API key lookup
- Set `tenantId` on the request context so all downstream code can access it
- Reject requests that cannot be resolved to a tenant (except public routes)
- Create a `requireTenantContext()` helper that API routes can call

**Files**: `src/middleware.ts`, new `src/lib/auth/tenant-context.ts`

---

### Task 1.3 — Fix `tenantId` on `AuthResult`

Currently `tenantId` is optional on `AuthResult` and is only set for API key authentication. JWT and dev-header auth flows never set it.

**Requirements**:
- Make `tenantId` required on `AuthResult` (or create a `TenantAuthResult` that guarantees it)
- All auth flows must resolve and set `tenantId`:
  - JWT → look up user's tenant membership
  - API key → already works
  - Dev header → resolve from header or default tenant
- If a user belongs to multiple tenants, require explicit tenant selection (header or session)

**Files**: `src/lib/auth/middleware.ts`, `src/lib/auth/types.ts`

---

### Task 1.4 — Add authentication to all unauthenticated API routes

These routes currently have **no authentication at all**:

| Route | Severity | Issue |
|-------|----------|-------|
| `GET /api/conversations/[sessionId]` | 🔴 Critical | Anyone can read any conversation |
| `GET/PUT/DELETE /api/tools/connections/[connectionId]` | 🔴 Critical | Can read credentials, modify, or delete any tenant's connections |
| `POST /api/tools/register` | 🔴 Critical | Accepts `tenantId` from untrusted request body |
| `GET /api/tools/tenant/[tenantId]` | 🟠 High | Lists any tenant's tools |
| `POST /api/tools/connections/[connectionId]/test` | 🟠 High | Can trigger health checks on any connection |
| `GET /api/debug/*` | 🟡 Medium | Debug endpoints exposed |
| `GET /api/webhooks/log` | 🟡 Medium | Raw webhook payloads exposed |

**Requirements**:
- Add `authenticateRequest()` to every route above
- Verify that the authenticated user/key belongs to the tenant that owns the resource
- `POST /api/tools/register` must derive `tenantId` from the authenticated caller, not the request body

**Files**: All routes listed above

---

### Task 1.5 — Scope all data access by tenant

Every database query in the data access layer must filter by `tenantId`. Currently none of them do.

| Data Access File | Functions to Fix |
|-----------------|------------------|
| `src/lib/db/sessions.ts` | `getSession()`, `createSession()`, `listSessions()` |
| `src/lib/db/messages.ts` | `getMessages()`, `createMessage()` |
| `src/lib/db/users.ts` | `getUser()`, `findUserByEmail()` |
| `src/lib/db/repos.ts` | `getRepos()`, `getRepoByName()` |
| `src/lib/db/audit.ts` | `getAuditLogs()` |
| `src/lib/analytics/` | All analytics queries |
| `src/lib/learning/` | Learning signal queries |
| `src/lib/feedback/` | Feedback queries |

**Rule**: Every `prisma.*.findMany()`, `findFirst()`, `findUnique()`, `create()`, `update()`, `delete()` must include `where: { tenantId }` (or the create must set `tenantId`).

---

### Task 1.6 — Scope knowledge retrieval to tenant

`retrieveContext()` in `src/lib/knowledge/retrieval.ts` searches the global vector store with no tenant filter. Documents indexed for Tenant A appear in Tenant B's agent responses.

**Requirements**:
- Add `tenantId` filter to all vector similarity searches
- Ensure the embedding table has a `tenantId` column (from Task 1.1) and uses it in the `WHERE` clause
- Add a tenant filter parameter to `retrieveContext()`

---

### Task 1.7 — Replace shared `ADMIN_API_KEY` with per-tenant admin auth

A single global `ADMIN_API_KEY` from the environment acts as a skeleton key for all tenants. 

**Requirements**:
- Admin endpoints must authenticate via JWT (checking role=admin) or per-tenant `TenantApiKey`
- Remove global `ADMIN_API_KEY` or demote it to superAdmin-only
- Per-tenant admin isolation: Tenant A's admin cannot see Tenant B's data

---

### Task 1.8 — Replace all hardcoded tenant IDs

The literal string `'cmnhsjh850000a1y1b69ji257'` (EdLight's tenant ID) appears in **7 files**:

| File | What it locks |
|------|--------------|
| `src/lib/channels/email-adapter.ts` | Email channel only works for EdLight |
| `src/lib/channels/identity-linker.ts` | Identity linking only for EdLight |
| `src/app/api/cron/process-reminders/route.ts` | Reminder cron hardcoded to EdLight |
| `src/app/api/cron/daily-birthdays/route.ts` | Birthday cron hardcoded to EdLight |
| `src/app/api/cron/email-poll/route.ts` | Email polling hardcoded to EdLight |
| `src/app/api/admin/drive-index/route.ts` | Drive indexing hardcoded to EdLight |
| Cron context builder | Context building hardcoded to EdLight |

**Requirements**:
- Cron jobs must iterate over all active tenants with the relevant `ConnectedProvider`
- Channel adapters must resolve tenant from the inbound message context (phone number mapping, webhook config, etc.)
- Zero hardcoded tenant IDs anywhere in the codebase
- `grep -r 'cmnhsjh850000a1y1b69ji257' src/` must return zero results

---

# Phase 2 — AI Provider Agnosticism (Critical)

> **Priority: P0 — Breaks the RAG pipeline and tools if only non-OpenAI keys are available.**

The `AIProvider` interface and `FallbackProvider` chain are well-designed. But the abstraction is bypassed in critical places.

### Task 2.1 — Remove direct OpenAI SDK usage from tools

Three tools directly instantiate `new OpenAI()`, completely bypassing the provider abstraction:

| File | What it does |
|------|-------------|
| `src/lib/tools/translate.ts` | Direct `openai.chat.completions.create()` |
| `src/lib/tools/summarize.ts` | Direct `openai.chat.completions.create()` |
| Tool scaffolding files | Direct SDK usage |

**Requirements**:
- Replace all `new OpenAI()` calls with `getAIProvider().chatCompletion()`
- Zero imports from `'openai'` package outside `src/lib/ai/openai.ts`
- Verification: `grep -r "new OpenAI" src/ --include="*.ts" | grep -v "src/lib/ai/"` must return zero results

---

### Task 2.2 — Make embeddings provider-agnostic

Currently embeddings are hardcoded to OpenAI. Both Gemini and Anthropic adapters throw `"not supported"` errors for embeddings.

**Requirements**:
- Add new env vars: `EMBEDDING_PROVIDER` (default: `openai`) and `EMBEDDING_MODEL`
- Implement embeddings in the Gemini adapter using `text-embedding-004` (768 dimensions)
- For Anthropic: document that a separate embedding provider must be configured (Anthropic has no embedding API)
- The `FallbackProvider` must route embeddings to the configured embedding provider, not just "the first one that supports it"
- Update `src/lib/ai/fallback.ts` accordingly

---

### Task 2.3 — Make embedding dimension configurable

The database schema hardcodes `vector(1536)` — OpenAI's `text-embedding-3-small` dimension. Gemini uses 768, Cohere uses 1024.

**Requirements**:
- Add `EMBEDDING_DIMENSION` env var (default: `1536`)
- Use it in the Prisma schema (or a raw SQL migration that reads from config)
- Document that changing the embedding provider requires re-indexing all documents
- Add a guard: if the configured dimension doesn't match the DB column, fail fast at startup with a clear error

---

### Task 2.4 — Abstract the Realtime Voice API

`src/lib/ai/realtime.ts` is entirely OpenAI-specific with hardcoded `gpt-4o-realtime-preview`.

**Requirements**:
- Create a `RealtimeProvider` interface behind which OpenAI's implementation lives
- Add a `REALTIME_PROVIDER` env var
- When no realtime provider is available, fail gracefully (return "voice not available" rather than crash)
- This is acceptable as OpenAI-only for now, but must be behind an interface

---

### Task 2.5 — Fix hardcoded model name in analytics

`src/lib/analytics/` tracks `model: 'gpt-4o'` as a hardcoded string instead of reading from the actual provider response.

**Requirements**:
- Pass the actual model name from the `AIResponse` into analytics tracking
- The model field must reflect which provider actually handled the request (especially important when fallback fires)

---

### Task 2.6 — Rename OpenAI-prefixed env vars

Env var names like `OPENAI_CHAT_MODEL` and `OPENAI_EMBEDDING_MODEL` are used for generic, cross-provider features.

**Requirements**:
- Add generic aliases: `AI_CHAT_MODEL`, `AI_EMBEDDING_MODEL`
- Keep `OPENAI_*` as fallbacks for backward compatibility
- Document the preferred names in `.env.example` and README

---

# Phase 3 — Integration Agnosticism (High)

> **Priority: P1 — Blocks multi-tenant deployment for non-Google/Zoom integrations.**

Google Workspace and Zoom are the gold standard — credentials stored per-tenant in `ConnectedProvider`. Everything else uses global env vars.

### Task 3.1 — Move GitHub to per-tenant `ConnectedProvider`

Currently GitHub uses a single global `GITHUB_TOKEN` env var and a process-level singleton client. The repo list is a hardcoded array of EdLight-specific repositories.

**Requirements**:
- Add `github` as a provider type in `ConnectedProvider`
- Store per-tenant GitHub PATs or GitHub App installation tokens in the DB
- Make `GitHubClient` accept a token per-call (like the Zoom pattern)
- Remove the hardcoded repo list from `src/lib/github/repos.ts` — repos should be configured per-tenant (DB or admin UI)
- `getDefaultGitHubClient()` singleton must be removed or scoped to tenant

**Files**: `src/lib/github/client.ts`, `src/lib/github/repos.ts`, `src/lib/config/env.ts`

---

### Task 3.2 — Move WhatsApp to per-tenant `ConnectedProvider`

WhatsApp credentials (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`) are global env vars shared across all tenants.

**Requirements**:
- Add `whatsapp` as a provider type in `ConnectedProvider`
- Store per-tenant WhatsApp Business API credentials (token, phone number ID, business account ID) in the DB
- `WhatsAppAdapter` must load credentials from DB per tenant
- Webhook signature verification must use the tenant's app secret
- Webhook routing: inbound messages must be routed to the correct tenant based on the destination phone number ID

**Files**: `src/lib/channels/whatsapp-adapter.ts`, `src/lib/channels/whatsapp-groups.ts`, webhook route

---

### Task 3.3 — Move Instagram to per-tenant `ConnectedProvider`

Same pattern as WhatsApp — currently global env vars.

**Requirements**:
- Add `instagram` as a provider type in `ConnectedProvider`
- Store per-tenant Instagram credentials in the DB
- `InstagramAdapter` must load credentials from DB per tenant
- Webhook routing by Instagram page/account ID

**Files**: `src/lib/channels/instagram-adapter.ts`, webhook route

---

### Task 3.4 — Make web search per-tenant configurable

`BRAVE_API_KEY` is a global env var. Different tenants may want their own search quotas or may not want web search enabled at all.

**Requirements**:
- Add `brave_search` (or generic `web_search`) as a provider type in `ConnectedProvider`
- If a tenant has no web search provider configured, the web search tool should gracefully return "web search not available for this tenant"
- Keep env var as a global fallback for single-tenant deployments

---

### Task 3.5 — Remove org-specific content from code

Several files contain EdLight-specific branding that should come from tenant configuration:

| File | Content |
|------|---------|
| `src/lib/tools/birthday.ts` | Birthday message templates say "EdLight" |
| `src/lib/agents/prompts.ts` | Group chat prompt lists "Rony, Ted, Fredler, Herode, Christopher" as team members |
| `voice-bridge/` | Hardcoded `https://voice.edlight.org/webhook/calls` and `'You are Sandra, an AI voice assistant for EdLight.'` |

**Requirements**:
- All org-specific strings must come from `TenantAgentConfig` or `ConnectedProvider` config
- No tenant name, team member names, or org-specific URLs hardcoded in source code
- `grep -ri 'edlight' src/lib/ | grep -v test | grep -v node_modules` should only match generic references (like the fallback domain in env config)

---

### Task 3.6 — Eliminate `process.env` usage outside config module

8 instances of direct `process.env` access bypass the validated `env` object:

| File | Env Var |
|------|---------|
| WhatsApp webhook route | `process.env.WHATSAPP_VERIFY_TOKEN` |
| Instagram webhook route | `process.env.INSTAGRAM_VERIFY_TOKEN` |
| Voice bridge config | Various |
| Email transport | `process.env.EMAIL_*` |

**Requirements**:
- All env var access must go through `src/lib/config/env.ts`
- Add any missing vars to the Zod schema in env.ts
- `grep -r 'process\.env\.' src/ --include="*.ts" | grep -v 'env.ts' | grep -v node_modules | grep -v '.test.'` should return zero results (except `NODE_ENV` checks which are acceptable)

---

# Phase 4 — Channel Agnosticism (Medium)

> **Priority: P2 — Current abstraction is good, these are refinements.**

The `ChannelAdapter` → `InboundMessage` → `OutboundMessage` abstraction is the strongest area. These tasks close the remaining gaps.

### Task 4.1 — Move channel-specific prompt logic to adapters

`src/lib/agents/prompts.ts` has a hardcoded `if (channel === 'whatsapp' || channel === 'instagram')` block that injects messaging-style instructions.

**Requirements**:
- Each `ChannelAdapter` should expose an optional `getPromptStyle(): string` method
- The prompt builder reads from the adapter instead of hardcoding channel names
- Adding a new social channel (e.g., Telegram) should not require modifying the prompt builder

---

### Task 4.2 — Make reminder delivery use `ChannelAdapter`

`src/app/api/cron/process-reminders/route.ts` has inline WhatsApp API calls (`fetch('https://graph.facebook.com/...')`) and inline Gmail API calls — completely bypassing the channel adapter abstraction.

**Requirements**:
- Use `channelAdapterFactory.get('whatsapp').send()` instead of raw API calls
- Same for email delivery
- The cron job should check the user's preferred channel and use the appropriate adapter

---

### Task 4.3 — Generalize identity linker beyond phone numbers

`src/lib/channels/identity-linker.ts` only supports WhatsApp phone number → Google Workspace identity mapping.

**Requirements**:
- Create a pluggable identity resolution strategy per channel type
- Instagram PSIDs, email addresses, and voice caller IDs should also resolve to workspace identities
- Factor out the phone-suffix matching into a WhatsApp-specific strategy

---

### Task 4.4 — Unify channel type definitions

The `ChannelType` union in `src/lib/channels/types.ts` is the canonical source, but multiple files define their own lists:

| File | Channels Listed |
|------|----------------|
| `src/lib/channels/types.ts` | `'web' \| 'whatsapp' \| 'instagram' \| 'email' \| 'voice'` |
| `src/lib/tools/updateUserPreferences.ts` | `['whatsapp', 'web', 'voice', 'sms']` — missing `instagram`, has `sms` |
| `src/lib/tools/sendMessage.ts` | `['web', 'whatsapp', 'email', 'instagram']` — missing `voice` |

**Requirements**:
- All files must import and reuse `ChannelType` from the canonical source
- Remove all inline string literal channel lists
- Add a `DEFAULT_CHANNEL` constant in `src/lib/channels/types.ts` to replace the 7+ scattered `?? 'web'` defaults

---

### Task 4.5 — Broaden email verification to all channels

`src/lib/channels/email-verification.ts` only supports `'whatsapp' | 'instagram'` for identity linking verification codes.

**Requirements**:
- Accept the full `ChannelType` (or a configurable subset)
- Use a channel-name map for the email body text instead of a hardcoded ternary

---

# Validation Gates

V7 is complete when:

### Functional
- [ ] A second test tenant can be created with its own credentials, tools, and knowledge base
- [ ] Tenant A's admin cannot see Tenant B's sessions, messages, analytics, or documents
- [ ] Sandra works with `AI_PROVIDER_PRIORITY=gemini` and no OpenAI key (except realtime voice)
- [ ] Sandra works with `AI_PROVIDER_PRIORITY=anthropic` and no OpenAI key (with a configured embedding provider)
- [ ] All cron jobs process data for all active tenants, not just EdLight
- [ ] WhatsApp/Instagram credentials are loaded from DB, not env vars

### Code Quality
- [ ] `grep -r 'cmnhsjh850000a1y1b69ji257' src/` returns 0 results
- [ ] `grep -r 'new OpenAI' src/ | grep -v 'src/lib/ai/'` returns 0 results
- [ ] `grep -r 'process\.env\.' src/ --include='*.ts' | grep -v env.ts | grep -v test | grep -v '.next'` returns 0 results (except `NODE_ENV`)
- [ ] `grep -ri 'edlight' src/lib/ | grep -v test` returns only generic/configurable references

### Tests
- [ ] All existing tests still pass
- [ ] New tests: multi-tenant data isolation (Tenant A can't read Tenant B's data)
- [ ] New tests: AI provider fallback with no OpenAI key
- [ ] New tests: embedding dimension mismatch detection
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run build` — exit 0

---

# Issue Summary

| Severity | Count | Phase |
|----------|:-----:|:-----:|
| 🔴 Critical | 16 | Phase 1 (9), Phase 2 (2), Phase 3 (5) |
| 🟠 High | 12 | Phase 1 (3), Phase 2 (3), Phase 3 (4), Phase 4 (2) |
| 🟡 Medium | 11 | Phase 2 (3), Phase 3 (3), Phase 4 (5) |
| 🟢 Low | 5 | Phase 2 (2), Phase 4 (3) |
| **Total** | **44** | |

---

# Implementation Order

```
Phase 1 (Multi-Tenant)     ████████████████████  ~60% of work
  1.1 Schema migration
  1.2 Middleware tenant resolution
  1.3 AuthResult tenantId
  1.4 Auth on unauthenticated routes
  1.5 Tenant-scoped data access
  1.6 Tenant-scoped knowledge retrieval
  1.7 Per-tenant admin auth
  1.8 Remove hardcoded tenant IDs

Phase 2 (AI Provider)      ████████             ~20% of work
  2.1 Remove direct OpenAI from tools
  2.2 Embedding provider abstraction
  2.3 Configurable embedding dimension
  2.4 Realtime voice interface
  2.5 Fix analytics model tracking
  2.6 Rename env vars

Phase 3 (Integration)      ██████               ~15% of work
  3.1 GitHub per-tenant
  3.2 WhatsApp per-tenant
  3.3 Instagram per-tenant
  3.4 Web search per-tenant
  3.5 Remove org-specific content
  3.6 Eliminate process.env leaks

Phase 4 (Channel)          ██                    ~5% of work
  4.1 Channel prompt styles
  4.2 Reminder delivery via adapter
  4.3 Generalize identity linker
  4.4 Unify channel types
  4.5 Broaden email verification
```

---

# What This Release Does NOT Include

- New features or channels
- UI changes (except admin screens needed for per-tenant config)
- New tools
- Performance optimization
- New integrations

V7 is a **purity release**. It makes the existing architecture honest.

---

*Audit conducted and documented by GitHub Copilot — April 6, 2026.*
