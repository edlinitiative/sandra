# Sandra AI Platform — Master Task List

> Historical planning note: this task list reflects the original V1 implementation
> plan. It is no longer the authoritative status tracker for the current release.
> Use `progress.md` plus `docs/releases/v2.md` for current execution status.

## How to Use This Document

- Tasks are numbered T001–T129 sequentially (with intentional gaps between phases)
- [P] = parallelizable with other [P] tasks in same phase
- Check off tasks as completed: `- [x] T001 ...`
- Dependencies noted as "depends: T001, T003"
- Each phase has a detailed doc in `phaseN_*.md`

## Progress Summary

- **Plan type:** Historical V1 implementation backlog
- **Authoritative current status:** `progress.md`
- **Authoritative current release scope:** `docs/releases/v2.md`
- **Recommended use now:** Backlog reference only; do not use these counters as the current release status

---

## Phase 0 — Test Infrastructure (depends: nothing)

> Detailed specs: [phase0_test_infrastructure.md](phase0_test_infrastructure.md)

### Task 0.1: Test Framework Setup

- [ ] T001 Install and configure Vitest with Next.js 15 + TypeScript support (depends: nothing)
- [ ] T002 Create test utilities and mock helpers (Prisma mock, AIProvider mock, fixtures) (depends: T001)
- [ ] T003 [P] Add test scripts to package.json (test, test:watch, test:coverage) (depends: T001)

---

## Phase 1 — Foundation (depends: Phase 0)

> Detailed specs: [phase1_foundation.md](phase1_foundation.md)

### Task 1.1: Database Schema and Data Layer (F10)

- [ ] T010 Review and finalize Prisma schema with all 7 V1 models (depends: nothing)
- [ ] T011 Create and apply database migration (depends: T010)
- [ ] T012 Verify and enhance seed data for 4 EdLight repositories (depends: T011)
- [ ] T013 Create typed data access helpers (sessions, messages, repos, documents) (depends: T011)
- [ ] T014 Database layer unit tests (depends: T013, T002)

### Task 1.2: Security and Error Handling (F12)

- [ ] T015 [P] Complete SandraError subclasses (Validation, Auth, NotFound, Provider, Tool) (depends: nothing)
- [ ] T016 Environment secrets validation via Zod (depends: T015)
- [ ] T017 [P] Structured logging utility with JSON output and requestId (depends: nothing)
- [ ] T018 Input sanitization and Zod validation schemas (depends: T015)
- [ ] T019 Security and error handling unit tests (depends: T015, T016, T017, T018, T002)

### Task 1.3: LLM Provider Abstraction (F8)

- [ ] T020 [P] Finalize AIProvider interface types (chat, streaming, embedding) (depends: nothing)
- [ ] T021 Complete OpenAI chat completion implementation with tool calling (depends: T020)
- [ ] T022 [P] Complete OpenAI streaming implementation (depends: T020)
- [ ] T023 [P] Complete embedding generation (text-embedding-3-small) (depends: T020)
- [ ] T024 Provider factory with environment-based configuration (depends: T020, T021, T016)
- [ ] T025 AI provider unit tests (depends: T021, T022, T023, T024, T002)

### Task 1.4: Multilingual Support (F7)

- [ ] T026 [P] Language enum and type definitions (en, fr, ht) (depends: nothing)
- [ ] T027 Language detection and selection utility (depends: T026)
- [ ] T028 System prompt helpers for multilingual behavior (depends: T026)
- [ ] T029 Multilingual support unit tests (depends: T026, T027, T028, T002)

---

## Phase 2 — Core Engine (depends: Phase 1)

> Detailed specs: [phase2_core_engine.md](phase2_core_engine.md)

### Task 2.1: Conversation Session Management (F6)

- [ ] T030 Session CRUD operations (create, get, update) (depends: T013)
- [ ] T031 Message persistence (add, get with ordering and limit) (depends: T013)
- [ ] T032 Session context loader (recent N messages for LLM) (depends: T030, T031)
- [ ] T033 Session-scoped short-term memory (key-value facts) (depends: T030)
- [ ] T034 Session management unit tests (depends: T030, T031, T032, T033, T002)

### Task 2.2: Tool Registry and Execution (F5)

- [ ] T035 Tool interface and self-registration registry (depends: T015)
- [ ] T036 Tool executor with permission scope enforcement (depends: T035)
- [ ] T037 searchKnowledgeBase tool implementation (depends: T035, T043, T044)
- [ ] T038 [P] lookupRepoInfo tool implementation (depends: T035, T013)
- [ ] T039 [P] getEdLightInitiatives tool implementation (depends: T035, T013)
- [ ] T040 Tool system unit tests (depends: T035, T036, T037, T038, T039, T002)

### Task 2.3: Knowledge Retrieval (RAG) Pipeline (F3)

- [ ] T041 [P] Markdown-aware document chunker (depends: nothing)
- [ ] T042 Embedding generation module (batch wrapper over AIProvider) (depends: T023)
- [ ] T043 [P] VectorStore interface and InMemoryVectorStore (depends: nothing)
- [ ] T044 Retrieval module (query → embed → search → rank) (depends: T042, T043)
- [ ] T045 Knowledge ingestion pipeline (chunk → embed → store) (depends: T041, T042, T043)
- [ ] T046 RAG pipeline unit tests (depends: T041, T042, T043, T044, T045, T002)

---

## Phase 3 — Agent & Indexing (depends: Phase 2)

> Detailed specs: [phase3_agent_and_indexing.md](phase3_agent_and_indexing.md)

### Task 3.1: Sandra Agent Runtime (F2)

- [ ] T060 [P] Channel message types (InboundMessage, OutboundMessage, ChannelAdapter) (depends: nothing)
- [ ] T061 System prompt builder (persona + language + tools + guidelines) (depends: T028, T035)
- [ ] T062 Context assembly module (history + memory + tools → AgentContext) (depends: T032, T033, T061)
- [ ] T063 ReAct agent loop core (input → context → LLM → tool calls → response) (depends: T062, T036, T021)
- [ ] T064 Tool call execution within agent loop (parse, invoke, format results) (depends: T063, T036)
- [ ] T065 Max-iteration guard and error recovery (depends: T063)
- [ ] T066 Agent streaming support (async generator yielding token events) (depends: T063, T022)
- [ ] T067 Agent runtime unit tests (depends: T063, T064, T065, T002)
- [ ] T068 Agent integration test (full pipeline with mock LLM) (depends: T063, T064, T065, T066, T060)

### Task 3.2: Repository Indexing System (F4)

- [ ] T069 GitHub API client (authenticated requests, rate limit handling) (depends: T016)
- [ ] T070 Repository content fetcher (README + docs .md files) (depends: T069, T013)
- [ ] T071 [P] Content hash and change detection (SHA-256) (depends: T013)
- [ ] T072 Indexing orchestrator (fetch → hash check → RAG pipeline → track records) (depends: T070, T071, T045)
- [ ] T073 IndexedSource and IndexedDocument management (depends: T072)
- [ ] T074 [P] Indexing job status tracking (IndexingResult type) (depends: T072)
- [ ] T075 Repository indexing unit tests (depends: T069, T070, T071, T072, T073, T074, T002)

---

## Phase 4 — Interface Layer (depends: Phase 3)

> Detailed specs: [phase4_interface_layer.md](phase4_interface_layer.md)

### Task 4.1: API Layer (F9)

- [ ] T090 Request ID middleware and JSON envelope helper (depends: T017)
- [ ] T091 POST /api/chat endpoint (depends: T090, T063, T018)
- [ ] T092 POST /api/chat/stream SSE endpoint (depends: T090, T066)
- [ ] T093 GET /api/conversations/[sessionId] endpoint (depends: T090, T030)
- [ ] T094 [P] GET /api/health endpoint (depends: T090)
- [ ] T096 API layer unit tests (depends: T091, T092, T093, T094, T002)

### Task 4.2: Web Chat Interface (F1)

- [ ] T097 Chat container component (message list + input area) (depends: nothing)
- [ ] T098 Message input with send functionality (Enter key, loading state) (depends: T097)
- [ ] T099 API client service (sendMessage, streamMessage, getConversation) (depends: T091, T092)
- [ ] T100 Streaming response rendering (word-by-word tokens) (depends: T097, T099)
- [ ] T101 [P] Typing indicator component (animated three dots) (depends: T097)
- [ ] T102 Session continuity (localStorage sessionId + history restore) (depends: T097, T099, T093)
- [ ] T103 [P] Empty state with suggested questions (4 per language) (depends: T097, T026)
- [ ] T104 [P] Language selector component (dropdown: en/fr/ht) (depends: T026)
- [ ] T105 Responsive layout (320px minimum, mobile-first) (depends: T097, T098)
- [ ] T106 Chat UI component tests (depends: T097, T098, T099, T100, T101, T102, T103, T104, T105)

### Task 4.3: Admin Indexing Controls (F11)

- [ ] T107 API key authentication middleware (x-api-key header) (depends: T015, T016)
- [ ] T108 GET /api/repos endpoint (list repos with status) (depends: T107, T090, T013)
- [ ] T109 POST /api/index endpoint (trigger indexing) (depends: T107, T090, T072)
- [ ] T111 Admin endpoints unit tests (depends: T107, T108, T109, T002)

---

## Phase 5 — Integration & Polish (depends: Phase 4)

> Detailed specs: [phase5_integration_and_polish.md](phase5_integration_and_polish.md)

### Task 5.1: End-to-End Verification

- [ ] T120 End-to-end chat flow verification (UI → API → agent → response) (depends: T091, T097, T100, T063)
- [ ] T121 End-to-end indexing pipeline verification (trigger → fetch → RAG → search) (depends: T072, T109, T108)
- [ ] T122 [P] Multilingual response verification (system prompt adapts per language) (depends: T028, T091)
- [ ] T123 [P] Error handling verification (all endpoints return proper envelopes) (depends: T091, T092, T093, T108, T109)
- [ ] T124 [P] Session continuity verification (multi-turn context preserved) (depends: T091, T093, T102)

### Task 5.2: Quality Gates

- [ ] T125 Build and type safety verification (tsc, lint, build) (depends: all prior tasks)
- [ ] T126 [P] Security audit (no hardcoded secrets, no raw console.log, all inputs validated) (depends: all prior tasks)
- [ ] T127 Full test suite execution (all tests pass, coverage report) (depends: T120, T121, T122, T123, T124, T125, T126)
- [ ] T128 [P] Performance baseline (health < 500ms, chat < 1s, search < 500ms) (depends: T091, T094)
- [ ] T129 Final integration smoke test (dev server starts, UI renders, all gates green) (depends: T125, T126, T127, T128)
