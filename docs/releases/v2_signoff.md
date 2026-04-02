# Sandra V2 Release Signoff

## Purpose

This is the canonical release-signoff checklist for Sandra V2.

Use this document when deciding whether the stable web/admin product is ready to ship.
When older planning docs disagree with this checklist, update the older docs rather than
changing the release truth here.

## Current Signoff State

**✅ V2 is signed off and shipped — March 25, 2026.**

- All validation gates green: `npm test` (544 passing), `npx tsc --noEmit`, `npm run build`
- Benchmark prompts reviewed in live chat UI — answers are accurate and grounded
- Operator QA completed in admin dashboard:
  - Admin key entry works; invalid key shows clear error
  - Database-unavailable state handled gracefully (amber banner, no raw errors)
  - Health endpoint reports clean status summaries
  - 8 tools registered and functional
- All fallback data replaced with real edlight.org content (no fabricated data)
- 5 EdLight programs covered: ESLP, Nexus, Academy, Code, Labs
- EdLight News URL corrected to news.edlight.org
- Tool-call UI indicator working in streaming chat
- Chat streaming completes with proper terminal events

## V2 Contract Freeze

### Public Chat

- `POST /api/chat`
  - Validates input
  - Returns the standard JSON envelope
  - Persists session continuity

- `POST /api/chat/stream`
  - Uses SSE
  - Emits `start`
  - Emits zero or more `token`
  - Emits zero or more `tool_call`
  - Ends with exactly one `done` or `error`
  - `done` includes `sessionId`, `response`, `toolsUsed`, `retrievalUsed`, and `suggestedFollowUps`

### Admin APIs

- `GET /api/repos`
  - Requires admin API key
  - Returns stable repo summary rows for the dashboard

- `POST /api/index`
  - Requires admin API key
  - Accepts optional `repoId`
  - No `repoId` means index all active repos
  - Returns per-repo results and a partial-success summary

- `GET /api/health`
  - Returns service status plus repo, tool, and knowledge summaries

## Benchmark Prompts

These prompts must be reviewed before signoff:

- What is EdLight?
- What courses are on EdLight Academy?
- What courses exist on EdLight Code?
- What does EdLight Initiative do?
- What is EdLight News?
- What scholarships or programs are available?
- What happens when indexed data is unavailable?

## Expected Benchmark Behavior

- Course questions route to course-aware knowledge and do not collapse into generic initiative summaries
- Academy and Code answers remain distinct
- News and Initiative answers do not return course listings
- Answers use indexed repository knowledge when available
- If grounded data is unavailable, Sandra says so explicitly instead of pretending
- Streaming responses remain coherent when tools are used

## Operator QA Checklist

- Admin key entry works in the dashboard
- Missing or invalid admin key renders a clear error state
- Repo list loads with correct sync state and indexed document counts
- Single-repo indexing succeeds
- Index-all succeeds when no `repoId` is provided
- Partial failure is surfaced without hiding successful repos
- Health endpoint reports status and summaries correctly
- Chat streaming completes with one terminal event
- Session reload restores the final assistant response

## Validation Gates

- `npm test`
- `npx tsc --noEmit`
- `npm run build`

## Documentation Gates

- `docs/PRD.md` reflects the current release stage
- Historical planning docs are marked as historical where they drift
- Release and implementation docs reference the same API and streaming contracts
- Next-phase sequencing is explicit: signoff first, then memory/auth foundations, then channels

## Ship / No-Ship Rule

Ship when:

- benchmark behavior is acceptable
- operator QA is complete
- all validation gates pass
- no known regressions remain in routing, grounding, indexing, or streaming continuity

Do not ship when:

- benchmark prompts still misroute
- admin/indexing behavior is ambiguous
- streaming/session continuity regresses
- docs are still materially misleading about the current product state
