# Phase 5: Integration & Polish

## Prerequisites

- Phase 4 complete: all API and UI tests pass
- `npx vitest run` — full test suite passes
- `npm run build` completes without errors
- All API endpoints functional (chat, stream, health, repos, index, conversations)
- Web chat UI renders and handles messages
- Agent runtime processes messages through the ReAct loop

## Phase Goal

The entire Sandra platform is verified end-to-end: chat works from UI to agent to tools and back, indexing works from admin API through the RAG pipeline, all quality gates pass, and the system is ready for deployment.

## Phase Evaluation Criteria

- `npx vitest run` — full test suite passes (all phases)
- `npx tsc --noEmit` — zero type errors
- `npx next lint` — zero lint errors
- `npm run build` — production build succeeds
- End-to-end: send message via UI → agent processes → response appears in chat
- End-to-end: trigger indexing → repo indexed → knowledge searchable
- Multilingual: system prompt changes based on language parameter (en/fr/ht)
- Health endpoint reports all dependencies healthy
- Chat UI works at 320px viewport width
- All API error responses follow the standard JSON envelope
- No `console.log` statements outside of the structured logger
- No hardcoded secrets in source code (grep for API keys, passwords)

---

## Tasks

### T120: End-to-End Chat Flow Verification

**PRD Reference:** Section 6 (Conversational AI), Section 9 (User Journeys)
**Depends on:** T091, T097, T100, T063
**Blocks:** Nothing
**User Stories:** US-09, US-16, US-17
**Estimated scope:** 1 hour 30 min

#### Description

Write an end-to-end test that verifies the complete chat flow: user sends a message through the web chat → API receives it → agent processes it → response streams back to the UI.

#### Acceptance Criteria

- [ ] Test sends a POST to /api/chat with a test message
- [ ] Response contains a valid sessionId and assistant response
- [ ] Follow-up message with the same sessionId returns contextual response
- [ ] Streaming endpoint delivers token events and completes with 'done'
- [ ] Conversation endpoint returns both messages in order

#### Files to Create/Modify

- `src/__tests__/e2e/chat-flow.test.ts` — (create) end-to-end chat flow test

#### Implementation Notes

- This test uses the actual API handlers but with a mocked AIProvider
- Mock the AIProvider to return predictable responses
- Test sequence: 1) POST /api/chat → get sessionId, 2) POST /api/chat with sessionId → follow-up, 3) GET /api/conversations/sessionId → both messages
- For streaming: collect events from the SSE response and verify sequence
- Use a fresh database state (or mock Prisma) for isolation

#### Evaluation Checklist

- [ ] `npx vitest run src/__tests__/e2e/chat-flow.test.ts` passes
- [ ] SessionId is consistent across the conversation

---

### T121: End-to-End Indexing Pipeline Verification

**PRD Reference:** Section 7 (EdLight Ecosystem), Section 8 (Ecosystem Expansion)
**Depends on:** T072, T109, T108
**Blocks:** Nothing
**User Stories:** US-12, US-13
**Estimated scope:** 1 hour

#### Description

Write an end-to-end test that verifies the complete indexing flow: trigger indexing → fetch documents → process through RAG pipeline → verify searchable.

#### Acceptance Criteria

- [ ] Test triggers indexing for a test repository (mocked GitHub responses)
- [ ] Indexing processes documents through chunk → embed → store pipeline
- [ ] After indexing, `retrieveRelevant()` returns results for a related query
- [ ] Re-indexing with unchanged content skips documents (content hash check)
- [ ] GET /api/repos shows the repository as "indexed"

#### Files to Create/Modify

- `src/__tests__/e2e/indexing-flow.test.ts` — (create) end-to-end indexing test

#### Implementation Notes

- Mock GitHub API to return test markdown content
- Mock AIProvider for embedding generation (return consistent fake embeddings)
- Test the full pipeline: index → search → verify results contain expected content
- Test re-indexing: index same content → verify documents are skipped (0 processed)
- This test validates the wiring between: GitHub fetcher → chunker → embeddings → vector store → retrieval

#### Evaluation Checklist

- [ ] `npx vitest run src/__tests__/e2e/indexing-flow.test.ts` passes
- [ ] Indexed content is retrievable via search

---

### T122: Multilingual Response Verification

**PRD Reference:** Section 11 (Multilingual Support)
**Depends on:** T028, T091
**Blocks:** Nothing
**User Stories:** US-04
**Estimated scope:** 30 min

#### Description

Verify that the system prompt correctly adapts to all three languages and that the agent passes the language instruction to the LLM.

#### Acceptance Criteria

- [ ] POST /api/chat with `language: 'fr'` → system prompt includes French instruction
- [ ] POST /api/chat with `language: 'ht'` → system prompt includes Haitian Creole instruction
- [ ] POST /api/chat with no language → defaults to English instruction
- [ ] POST /api/chat with invalid language → falls back to English

#### Files to Create/Modify

- `src/__tests__/e2e/multilingual.test.ts` — (create) multilingual verification test

#### Implementation Notes

- Mock the AIProvider and capture the messages array passed to `chatCompletion`
- Inspect the system message to verify it contains the correct language instruction
- Test all three languages + default + invalid cases
- This verifies the integration between: API route → language resolution → prompt builder → LLM call

#### Evaluation Checklist

- [ ] `npx vitest run src/__tests__/e2e/multilingual.test.ts` passes

---

### T123: Error Handling Verification

**PRD Reference:** Section 15 (Security and Privacy)
**Depends on:** T091, T092, T093, T108, T109
**Blocks:** Nothing
**User Stories:** US-02
**Estimated scope:** 45 min

#### Description

Verify that all API endpoints handle errors consistently and return proper error envelopes.

#### Acceptance Criteria

- [ ] Invalid JSON body → 400 with error envelope
- [ ] Missing required fields → 400 with specific field errors
- [ ] Provider error (LLM down) → 502 with user-friendly message
- [ ] Not found → 404 with error envelope
- [ ] Internal error → 500 with generic message (no stack traces in production)
- [ ] All error responses include `meta.requestId`

#### Files to Create/Modify

- `src/__tests__/e2e/error-handling.test.ts` — (create) error handling verification

#### Implementation Notes

- Test each error scenario against each relevant endpoint
- Mock providers to simulate failures
- Verify response body matches: `{ success: false, error: { code, message }, meta: { requestId } }`
- Ensure no stack traces or internal details leak in error responses
- Test that requestId is present in all error responses for debugging

#### Evaluation Checklist

- [ ] `npx vitest run src/__tests__/e2e/error-handling.test.ts` passes
- [ ] No stack traces in error responses

---

### T124: Session Continuity Verification

**PRD Reference:** Section 13 (Memory System)
**Depends on:** T091, T093, T102
**Blocks:** Nothing
**User Stories:** US-05, US-06
**Estimated scope:** 30 min

#### Description

Verify that conversations persist and context is maintained across multiple turns.

#### Acceptance Criteria

- [ ] First message creates a session and returns sessionId
- [ ] Follow-up with sessionId includes prior context in LLM call
- [ ] GET /api/conversations/sessionId returns full history
- [ ] Context window respects the max message limit

#### Files to Create/Modify

- `src/__tests__/e2e/session-continuity.test.ts` — (create) session continuity test

#### Implementation Notes

- Send 3 sequential messages with the same sessionId
- After each message, verify the messages array sent to LLM grows
- Verify the conversation endpoint returns all messages in order
- Test context window: send 25+ messages, verify only the most recent N are in the LLM context

#### Evaluation Checklist

- [ ] `npx vitest run src/__tests__/e2e/session-continuity.test.ts` passes

---

### T125: Build and Type Safety Verification

**PRD Reference:** N/A (quality)
**Depends on:** All prior tasks
**Blocks:** T129
**User Stories:** N/A (infrastructure)
**Estimated scope:** 30 min

#### Description

Run the full build pipeline and type checker to ensure there are no compilation errors.

#### Acceptance Criteria

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npx next lint` passes with zero warnings
- [ ] `npm run build` completes successfully
- [ ] No unused imports or variables flagged by lint

#### Files to Create/Modify

- No new files — this is a verification task

#### Implementation Notes

- Run all three commands and fix any errors found
- Common issues: unused imports, type mismatches from mocking, missing return types
- If lint warnings exist, fix them or configure exceptions for intentional patterns
- Production build may reveal issues not caught by dev mode (e.g., dynamic imports, server/client boundary)

#### Evaluation Checklist

- [ ] `npx tsc --noEmit` exits with code 0
- [ ] `npx next lint` exits with code 0
- [ ] `npm run build` exits with code 0

---

### T126: Security Audit

**PRD Reference:** Section 15 (Security and Privacy)
**Depends on:** All prior tasks
**Blocks:** T129
**User Stories:** US-02
**Estimated scope:** 45 min

#### Description

Audit the codebase for security issues: hardcoded secrets, XSS vectors, missing input validation, and exposed internals.

#### Acceptance Criteria

- [ ] No hardcoded API keys, tokens, or passwords in source code
- [ ] No `console.log` with sensitive data (use structured logger instead)
- [ ] All API inputs validated with Zod
- [ ] User-provided HTML stripped before rendering (XSS prevention)
- [ ] Error responses don't expose stack traces or internal paths
- [ ] Environment variables accessed only through the validated config module

#### Files to Create/Modify

- No new files — this is an audit task. Fix any issues found in existing files.

#### Implementation Notes

- Search for patterns: `grep -r "api_key\|apikey\|secret\|password\|token" src/ --include="*.ts" --include="*.tsx"` (exclude env.ts and types)
- Search for raw `console.log` in `src/`: should only be in `logger.ts`
- Verify all API routes import validation schemas from `src/lib/utils/validation.ts`
- Check React components: no `dangerouslySetInnerHTML` without sanitization
- Verify `sanitizeInput()` is called on all user-provided text before processing

#### Evaluation Checklist

- [ ] `grep -r "OPENAI_API_KEY\|GITHUB_TOKEN\|ADMIN_API_KEY" src/ --include="*.ts"` returns only env.ts and config references
- [ ] No raw `console.log` outside of logger.ts

---

### T127: Full Test Suite Execution

**PRD Reference:** N/A (quality)
**Depends on:** T120, T121, T122, T123, T124, T125, T126
**Blocks:** T129
**User Stories:** N/A (infrastructure)
**Estimated scope:** 30 min

#### Description

Run the complete test suite and ensure all tests pass. Fix any failing tests.

#### Acceptance Criteria

- [ ] `npx vitest run` passes all tests (unit + integration + e2e)
- [ ] Test coverage report generated
- [ ] No skipped tests without a documented reason
- [ ] All test files follow naming convention: `*.test.ts` or `*.test.tsx`

#### Files to Create/Modify

- No new files — fix any failing tests in existing files

#### Implementation Notes

- Run `npx vitest run --reporter=verbose` for detailed output
- If any tests fail, diagnose and fix the root cause
- Run `npx vitest run --coverage` to generate coverage report
- Check that all key modules have test coverage

#### Evaluation Checklist

- [ ] `npx vitest run` exits with code 0 and all tests pass
- [ ] `npx vitest run --coverage` generates report

---

### T128: Performance Baseline

**PRD Reference:** Section 11 (Scalability, Low-Bandwidth)
**Depends on:** T091, T094
**Blocks:** T129
**User Stories:** N/A (infrastructure)
**Estimated scope:** 30 min

#### Description

Establish performance baselines for key operations to identify bottlenecks.

#### Acceptance Criteria

- [ ] Health endpoint responds in < 500ms
- [ ] Chat endpoint (with mocked LLM) responds in < 1 second
- [ ] Vector store search with 1000 documents completes in < 500ms
- [ ] Production build bundle size for main page < 200KB (gzipped JS)

#### Files to Create/Modify

- `src/__tests__/e2e/performance.test.ts` — (create) basic performance checks

#### Implementation Notes

- For API response times: measure with `Date.now()` before and after API calls
- For vector store: populate with 1000 fake documents, measure search time
- For bundle size: check `.next/static/` after build
- These are sanity checks, not load tests — just verify nothing is catastrophically slow
- Use generous thresholds — the goal is catching obvious regressions

#### Evaluation Checklist

- [ ] `npx vitest run src/__tests__/e2e/performance.test.ts` passes
- [ ] All baselines are within thresholds

---

### T129: Final Integration Smoke Test

**PRD Reference:** Section 16 (Development Roadmap — MVP)
**Depends on:** T125, T126, T127, T128
**Blocks:** Nothing
**User Stories:** All
**Estimated scope:** 30 min

#### Description

Final smoke test: start the development server and manually verify the critical path works.

#### Acceptance Criteria

- [ ] `npm run dev` starts without errors
- [ ] Navigating to `http://localhost:3000` shows the chat UI
- [ ] Empty state with suggested questions is visible
- [ ] Health endpoint returns "ok"
- [ ] Typing check passes: `npx tsc --noEmit` clean
- [ ] Lint check passes: `npx next lint` clean
- [ ] All tests pass: `npx vitest run` clean

#### Files to Create/Modify

- No new files — this is a verification task

#### Implementation Notes

- This is the final quality gate before the project is considered MVP-complete
- Verify visually: chat UI renders, language selector works, responsive layout works
- Verify programmatically: health check, type check, lint, tests
- Document any known issues or limitations discovered during this verification

#### Evaluation Checklist

- [ ] `npm run dev` starts cleanly
- [ ] `npx tsc --noEmit` exits with code 0
- [ ] `npx next lint` exits with code 0
- [ ] `npx vitest run` exits with code 0
- [ ] `npm run build` exits with code 0
