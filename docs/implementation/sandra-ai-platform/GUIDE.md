# Sandra AI Platform — Implementation Guide

## What We're Implementing

Sandra is an AI-powered conversational agent serving as the central interface for the EdLight ecosystem. V1 delivers web chat with multilingual support (English, French, Haitian Creole), knowledge retrieval from EdLight GitHub repositories, and an agentic ReAct runtime with tool calling.

- **PRD:** `.agent/prd.md` (read-only — do not modify)
- **Implementation docs:** `docs/implementation/sandra-ai-platform/`

## Document Map

- `tasks.md` — Master task list. Start here for the current phase.
- `features.md` — Feature registry (F1–F12) with dependencies.
- `user_stories.md` — User stories with acceptance criteria.
- `phase0_test_infrastructure.md` — Phase 0: Test framework setup.
- `phase1_foundation.md` — Phase 1: Database, errors, LLM provider, i18n.
- `phase2_core_engine.md` — Phase 2: Sessions, tools, RAG pipeline.
- `phase3_agent_and_indexing.md` — Phase 3: Agent runtime, GitHub indexing.
- `phase4_interface_layer.md` — Phase 4: API endpoints, web chat UI, admin controls.
- `phase5_integration_and_polish.md` — Phase 5: E2E tests, quality gates, polish.
- `progress.md` — Session log. Update after every session.

## Implementation Process

Work through phases sequentially. For each phase:

### 1. Read the Phase Document

Open `phaseN_*.md`. Read Prerequisites, Phase Goal, and Phase Evaluation Criteria before touching any code. If there are Infrastructure Updates Required, implement those first.

### 2. Implement Tasks in Order

Work through each task (T-IDs) sequentially. For each task:
- Read Description, Acceptance Criteria, Files to Create/Modify, and Implementation Notes
- **Verify implementation notes against actual code** — trust the code, not the doc
- Implement the task
- Check off Acceptance Criteria in the phase doc
- Check off the task in `tasks.md`

### 3. Verify the Phase

After all tasks complete:
- Run every command in Phase Evaluation Criteria
- All must pass. Fix issues before proceeding.

### 4. Review Pass

Second pass:
- Re-read phase doc, verify nothing missed
- Run full test suite to catch regressions
- Check linting and type checking

### 5. Update Progress

Add session entry to `progress.md` with tasks completed, blockers, discoveries, coverage, quality.

### 6. Proceed to Next Phase

Only when all tasks checked off, evaluation criteria pass, quality gates green.

## Quality Gates

Every phase must pass:

- **Linting clean:** `npx next lint` — zero warnings
- **Type checking passes:** `npx tsc --noEmit` — zero errors
- **All tests pass:** `npx vitest run` — no regressions
- **Coverage target met:** aim for meaningful coverage of business logic

## Conventions

- **Commit messages:** Conventional commits (`feat(scope): description`, `fix(scope): description`, `test(scope): description`)
- **Test file naming:** `*.test.ts` or `*.test.tsx`, co-located in `__tests__/` directories
- **Path aliases:** `@/` maps to `./src/`
- **Styling:** Tailwind CSS, mobile-first responsive design
- **Data access:** All database queries go through `src/lib/db/` helpers, never raw Prisma in business logic
- **Error handling:** Use SandraError subclasses, never throw raw Error in production code
- **Logging:** Use structured logger from `src/lib/utils/logger.ts`, never raw `console.log`
- **Environment config:** Access via validated config from `src/lib/config/env.ts`, never raw `process.env`

## DO NOT CHANGE

- `.agent/prd.md` — PRD is read-only, source of truth for requirements
- `prisma/schema.prisma` — After Phase 1 migration, schema changes require a new migration task
- `src/lib/ai/types.ts` — AIProvider interface is the contract; implementations can change, interface should not
- `src/lib/channels/types.ts` — InboundMessage/OutboundMessage types are the contract between channels and agent
- `src/lib/tools/types.ts` — SandraTool interface is the contract for all tools
- `src/lib/knowledge/vector-store.ts` — VectorStore interface must remain stable for production swap to pgvector
- Phase documents (`phase*.md`), `features.md`, `user_stories.md` — Do not modify during implementation
