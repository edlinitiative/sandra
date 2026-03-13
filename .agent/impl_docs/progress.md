# Sandra AI Platform Implementation Progress

## Current Status

- **Phase:** 2 (complete)
- **Tasks completed:** 40 / 86
- **Test coverage:** N/A
- **Last session:** N/A

## Phase Completion Loop

Each phase follows an implement → review → fix cycle:

```
┌─────────────────────┐
│ Implement Phase N    │  Session K: build all tasks
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Review Phase N       │  Session K+1: read phase doc, run all checks,
│                      │  compare output against evaluation criteria
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │ Issues?    │
     └─────┬─────┘
       Yes │         No
           ▼          ▼
┌──────────────┐  ┌──────────────────┐
│ Fix issues   │  │ Proceed to       │
│ + re-review  │  │ Phase N+1        │
└──────┬───────┘  └──────────────────┘
       │
       └──► (back to Review)
```

**What happens in a review session:**
1. Re-read the phase document's evaluation criteria
2. Run every evaluation command — record which pass and fail
3. Run the *full* test suite (not just the phase's tests) — catch regressions
4. Check linting and type checking
5. Read through code changes for logic errors tests don't catch
6. Log all issues found, fix them, log fixes in progress.md
7. If any issues were structural (not just typos), do another review pass

**Typical pattern:** 1–3 review sessions per phase. Budget for them.

**H24: Use a different agent/session for reviews** when possible. Fresh context catches what the builder missed.

## Session Log

<!-- Agents: Add a new session entry after each implementation session. -->

### Session 1 — 2026-03-13

**Goal:** Implement Phase 0 — Test Infrastructure
**Completed:** T001, T002, T003
**Infrastructure Updates Applied:** None
**Blockers:** None
**Discoveries:**
- All Phase 0 files were already present from a prior session; verified they work correctly
- `npx vitest` (via npx cache) fails because it downloads a different vitest version; use `node_modules/.bin/vitest` directly or `npm run test`
- node_modules were absent — ran `npm install` to restore them
**Changes:**
- `vitest.config.ts` — Vitest config with globals, node env, @/ path alias
- `package.json` — test/test:watch/test:coverage scripts already in place
- `src/lib/__tests__/mocks/prisma.ts` — mock Prisma client
- `src/lib/__tests__/mocks/ai-provider.ts` — mock AIProvider
- `src/lib/__tests__/helpers.ts` — test fixture factories
- `src/lib/__tests__/setup.test.ts` — smoke test (8 tests, all pass)
**Coverage:** 104 tests across 12 files, all passing
**Quality:** tsc clean, next lint clean, vitest run 104/104 pass
**Next:** Phase 0 review pass (or proceed to Phase 1)

### Session 2 — 2026-03-13

**Goal:** Implement Phase 1 — Foundation
**Completed:** T010, T011, T012, T013, T014, T015, T016, T017, T018, T019, T020, T021, T022, T023, T024, T025, T026, T027, T028, T029
**Infrastructure Updates Applied:** None
**Blockers:** None
**Discoveries:**
- All Phase 1 files were already fully implemented from a prior session
- `npx prisma validate` requires DATABASE_URL env var — expected in sandboxed container, migration file exists
- `npx prisma generate` runs cleanly and produces typed client (v6.19.2)
- All 12 test files pass; 104 tests total
**Changes:**
- Verified (no changes required): prisma/schema.prisma (7 models, all fields complete)
- Verified: prisma/seed.ts (4 EdLight repos + admin user, upsert pattern)
- Verified: src/lib/db/{sessions,messages,repos,documents}.ts (typed CRUD helpers)
- Verified: src/lib/utils/errors.ts (SandraError + 5 required subclasses + extras)
- Verified: src/lib/config/env.ts (Zod-validated, all required vars)
- Verified: src/lib/config/constants.ts (MAX_AGENT_ITERATIONS, CHUNK_SIZE, etc.)
- Verified: src/lib/utils/logger.ts (structured JSON, withRequestId, debug suppressed in prod)
- Verified: src/lib/utils/validation.ts (sanitizeInput, chatInputSchema, indexInputSchema, sessionIdSchema)
- Verified: src/lib/ai/types.ts (AIProvider interface, ChatCompletionRequest/Response, StreamChunk)
- Verified: src/lib/ai/openai.ts (chatCompletion, streamChatCompletion, generateEmbedding)
- Verified: src/lib/ai/provider.ts (singleton factory, getAIProvider)
- Verified: src/lib/i18n/types.ts + languages.ts (Language union, isValidLanguage, resolveLanguage)
- Verified: src/lib/agents/prompts.ts (getSandraSystemPrompt, getLanguageInstruction)
- Verified: all __tests__ files for db, utils, config, ai, i18n (11 test files, 96 phase-1 tests)
**Coverage:** 104 tests across 12 files, all passing (96 Phase 1 + 8 Phase 0 smoke tests)
**Quality:** tsc clean, next lint clean, npx prisma generate clean, vitest run 104/104 pass
**Next:** Phase 2 — Core Engine (T030–T046)

### Session 3 — 2026-03-13

**Goal:** Implement Phase 2 — Core Engine
**Completed:** T030, T031, T032, T033, T034, T035, T036, T037, T038, T039, T040, T041, T042, T043, T044, T045, T046
**Infrastructure Updates Applied:** None
**Blockers:** None
**Discoveries:**
- Most Phase 2 files were already present as stubs/placeholders — needed to be completed/wired
- Tool executor signature changed from `(name, argsJson)` to `(name, input, context)` — updated `sandra.ts` agent to pass ToolContext
- Added `scopes` field to `AgentInput` to support permission passing
- vi.mock hoisting means mock factories cannot reference top-level variables — must use `vi.fn()` inside the factory or `vi.mocked()` pattern
- ToolRegistry class is now exported for independent instantiation in tests
- Memory table has `userId_key` unique constraint — anonymous sessions use `session:{sessionId}` as namespace

**Changes:**
- `src/lib/tools/types.ts` — Added `ToolContext` (sessionId, userId?, scopes[]) and `requiredScopes` to `SandraTool`; renamed `execute` → `handler` with context param
- `src/lib/tools/registry.ts` — Exported `ToolRegistry` class; added `getAll()`, throw on duplicate, `getToolRegistry()` factory
- `src/lib/tools/executor.ts` — New signature with `ToolContext`; permission enforcement (AuthError); Zod validation (ValidationError); handler errors caught and returned as ToolResult
- `src/lib/tools/search-knowledge.ts` — Wired to `retrieveContext` from RAG pipeline; `requiredScopes: ['knowledge:read']`
- `src/lib/tools/lookup-repo.ts` — Wired to `getActiveRepos` db helper; input schema `{ repoName? }`; `requiredScopes: ['repos:read']`
- `src/lib/tools/get-initiatives.ts` — Added `requiredScopes: ['repos:read']`; category filter (coding/news/leadership/education)
- `src/lib/tools/index.ts` — Exports `ToolContext` and `getToolRegistry`
- `src/lib/memory/types.ts` — Added `ISessionStore` interface for DB-backed session/message CRUD
- `src/lib/memory/session-store.ts` — Added `PrismaSessionStore` with createSession, getSession, updateSession, addMessage, getMessages, loadContext; kept `InMemorySessionStore`
- `src/lib/memory/user-memory.ts` — Added `setSessionMemory` and `getSessionMemory` functions using Prisma Memory table
- `src/lib/knowledge/chunker.ts` — Rewrote to be markdown-aware: parseMarkdownSections, headingContext in chunk metadata
- `src/lib/agents/types.ts` — Added optional `scopes` field to `AgentInput`
- `src/lib/agents/sandra.ts` — Updated executeTool call to pass ToolContext
- Test files: `memory/__tests__/session-store.test.ts`, `memory/__tests__/user-memory.test.ts`, `tools/__tests__/registry.test.ts`, `tools/__tests__/executor.test.ts`, `tools/__tests__/tools.test.ts`, `knowledge/__tests__/chunker.test.ts`, `knowledge/__tests__/vector-store.test.ts`, `knowledge/__tests__/retrieval.test.ts`, `knowledge/__tests__/ingest.test.ts`

**Coverage:** 196 tests across 21 files, all passing (+92 Phase 2 tests)
**Quality:** tsc clean, next lint clean, vitest run 196/196 pass
**Next:** Phase 3 — Agent Runtime & GitHub Indexing (T047–T064)
