# Sandra V6 — Release Sign-off

**Version**: 0.2.0  
**Date**: April 6, 2026  
**Branch**: `main`  
**Deployed to**: `https://sandra.edlight.org`

---

## Summary

V6 focuses on **abuse prevention**, **admin self-service**, **developer documentation**, and **UI/UX polish**. All features are production-ready.

---

## What's New

### 1. Topic Scope Enforcement (Abuse Prevention)

Prevents users from using Sandra for purposes outside the tenant's domain.

- New `TenantAgentConfig` fields: `allowedTopics` (string array) and `offTopicResponse` (custom rejection message)
- `buildScopeBlock()` generates a hard scope-restriction block injected into the system prompt immediately after the identity block — giving it highest priority
- Jailbreak-resistant: refuses hypotheticals, games, "pretend you have no rules" prompts
- Baseline on-topic guideline added to `GENERIC_GUIDELINES` as a fallback even when no explicit topics are set
- EdLight seed updated with 10 allowed topics and a custom off-topic response
- Both `buildSandraSystemPrompt` (chat/WhatsApp/Instagram/email) and `getSandraSystemPrompt` (voice/streaming) enforce the scope

**Files changed**:
- `src/lib/agents/tenant-config.ts` — new interface fields
- `src/lib/agents/prompts.ts` — `buildScopeBlock()`, injection in both builders, baseline guideline
- `prisma/seed-tenant.ts` — EdLight tenant seeded with topics

### 2. Admin Settings UI (`/admin/settings`)

Allows admin users to edit all `TenantAgentConfig` fields directly from the website — no database access required.

- `GET /api/admin/agent-config` — returns tenant name, slug, domain, and full agentConfig
- `PATCH /api/admin/agent-config` — Zod-validated, merges with existing config, supports explicit `null` to clear a field
- Full form UI covering all 11 config fields organized into 4 sections:
  - 🤖 Identity: agentName, orgName, orgDescription, websiteUrl, contactEmail
  - 🌍 Languages: supportedLanguages (tag input)
  - 🛡️ Topic Scope: allowedTopics (tag input), offTopicResponse
  - 🧠 System Prompt: systemPromptOverride, additionalContext
- Save and Reset buttons, loading states, success/error feedback

**Files created**:
- `src/app/api/admin/agent-config/route.ts`
- `src/components/admin/agent-config-settings.tsx`
- `src/app/admin/settings/page.tsx`

### 3. Admin Navigation & Layout

Shared navigation across all admin pages, replacing ad-hoc back-buttons.

- `AdminNav` component with 3 links: Dashboard, Integrations, Settings
- Active state highlighting based on `usePathname()`
- Admin layout (`/admin/layout.tsx`) wraps all admin pages with consistent nav + content area

**Files created**:
- `src/components/admin/admin-nav.tsx`
- `src/app/admin/layout.tsx`

### 4. UI/UX Consistency Fixes

Audit and fix of 7 inconsistencies across admin pages:

1. Max-width standardized to `max-w-5xl` everywhere
2. Removed redundant `h-full overflow-y-auto` wrappers (layout handles scrolling now)
3. Removed stale `← Admin` back-button from integrations (AdminNav replaces it)
4. Subtitle styles standardized to `text-sm text-slate-400`
5. Consistent vertical spacing (`py-2` content, `space-y-8` sections)
6. Removed double padding (layout provides `px-6`)
7. Unmatched closing `</div>` tags fixed

**Files changed**:
- `src/components/admin/admin-dashboard.tsx`
- `src/components/admin/integrations-dashboard.tsx`
- `src/app/admin/integrations/page.tsx`

### 5. Landing Page Redesign

Complete redesign of the home page (`/`):

- Hero section with animated AI orb, radial background bloom, and gradient headline
- Bento grid layout for EdLight platforms (Code, Academy, News, Initiative)
- Developer CTA card linking to `/docs` with tag pills
- New footer with language selector
- Header updated: wider max-width, backdrop blur, "Developers" nav link added

**Files changed**:
- `src/app/page.tsx` — full rewrite
- `src/app/globals.css` — `.ai-orb-glow` animation
- `src/components/layout/header.tsx` — wider layout, Developers link

### 6. Developer Documentation Portal (`/docs`)

New `/docs` section for developers integrating Sandra into their products:

- Sidebar navigation (`DocsSidebar` component)
- Pages: Quickstart, API Reference, Channels, Knowledge Base, Multi-Tenant
- Integration guide document (`docs/embed.md`) — 373 lines covering Chat API, streaming, webhooks, voice, knowledge base, and multi-tenant setup

**Files created**:
- `src/app/docs/` — layout, page, and sub-pages
- `src/components/docs/docs-sidebar.tsx`
- `docs/embed.md`

### 7. Documentation Updates

- `README.md` — complete overhaul: accurate architecture diagram, tool registry table, comprehensive API reference, full env var documentation, production status
- `docs/integrations.md` — updated all sections with live status markers (✅), added Google Workspace, Zoom, Web Search, multi-tenant, and cron documentation

### 8. Utility Script

- `scripts/show-instagram-logs.ts` — debug script to list all Instagram channel messages

---

## Verification

| Check | Status |
|---|---|
| All 36 unit tests passing (23 prompt + 9 i18n + 4 admin) | ✅ |
| Scope block generates correctly with allowedTopics | ✅ |
| Scope block returns empty string when no topics configured | ✅ |
| Admin settings API validates input via Zod | ✅ |
| Admin settings UI loads and saves config | ✅ |
| Admin nav shows active state for current page | ✅ |
| UI consistent across all admin pages | ✅ |
| Landing page renders with bento grid | ✅ |
| Docs portal accessible at /docs | ✅ |
| TypeScript compiles with no errors | ✅ |

---

## Stats

| Metric | V5 | V6 |
|---|---|---|
| Tools | 66 | 66 |
| Channels | 5 | 5 |
| TenantAgentConfig fields | 9 | 11 |
| Admin pages | 2 (Dashboard, Integrations) | 3 (+ Settings) |
| Docs pages | 0 | 6 (portal + 5 sub-pages) |
| Landing page sections | 1 | 4 (hero, bento, dev CTA, footer) |

---

## Sign-off

- [x] Scope enforcement prevents off-topic abuse
- [x] Admins can self-service all agent config from the website
- [x] Admin navigation is consistent and shared
- [x] UI/UX is polished and consistent across all pages
- [x] Developer docs portal is live
- [x] README and integration docs are accurate and comprehensive
- [x] All tests pass
- [x] Ready for production

**Signed off by**: Sandra AI Agent  
**Date**: April 6, 2026
