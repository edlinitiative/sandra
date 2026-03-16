# Sandra AI Platform — Master Task List

## How to Use This Document

- Tasks are numbered T001–T129 sequentially (with intentional gaps between phases)
- [P] = parallelizable with other [P] tasks in same phase
- Check off tasks as completed: `- [x] T001 ...`
- Dependencies noted as "depends: T001, T003"
- Each phase has a detailed doc in `phaseN_*.md`

## Progress Summary

- **Total tasks:** 86
- **Completed:** 39
- **In progress:** 0
- **Blocked:** 0
- **Remaining:** 47

---

## Phase 0 — Test Infrastructure (depends: nothing)

> Detailed specs: [phase0_test_infrastructure.md](phase0_test_infrastructure.md)

### Task 0.1: Test Framework Setup

- [x] T001 Install and configure Vitest with Next.js 15 + TypeScript support (depends: nothing)
- [x] T002 Create test utilities and mock helpers (Prisma mock, AIProvider mock, fixtures) (depends: T001)
- [x] T003 [P] Add test scripts to package.json (test, test:watch, test:coverage) (depends: T001)

---

## Phase 1 — Foundation (depends: Phase 0)

> Detailed specs: [phase1_foundation.md](phase1_foundation.md)

### Task 1.1: Database Schema and Data Layer (F10)

- [x] T010 Review and finalize Prisma schema with all 7 V1 models (depends: nothing)
- [x] T011 Create and apply database migration (depends: T010)
- [x] T012 Verify and enhance seed data for 4 EdLight repositories (depends: T011)
- [x] T013 Create typed data access helpers (sessions, messages, repos, documents) (depends: T011)
- [x] T014 Database layer unit tests (depends: T013, T002)

### Task 1.2: Security and Error Handling (F12)

- [x] T015 [P] Complete SandraError subclasses (Validation, Auth, NotFound, Provider, Tool) (depends: nothing)
- [x] T016 Environment secrets validation via Zod (depends: T015)
- [x] T017 [P] Structured logging utility with JSON output and requestId (depends: nothing)
- [x] T018 Input sanitization and Zod validation schemas (depends: T015)
- [x] T019 Security and error handling unit tests (depends: T015, T016, T017, T018, T002)

### Task 1.3: LLM Provider Abstraction (F8)

- [x] T020 [P] Finalize AIProvider interface types (chat, streaming, embedding) (depends: nothing)
- [x] T021 Complete OpenAI chat completion implementation with tool calling (depends: T020)
- [x] T022 [P] Complete OpenAI streaming implementation (depends: T020)
- [x] T023 [P] Complete embedding generation (text-embedding-3-small) (depends: T020)
- [x] T024 Provider factory with environment-based configuration (depends: T020, T021, T016)
- [x] T025 AI provider unit tests (depends: T021, T022, T023, T024, T002)

### Task 1.4: Multilingual Support (F7)

- [x] T026 [P] Language enum and type definitions (en, fr, ht) (depends: nothing)
- [x] T027 Language detection and selection utility (depends: T026)
- [x] T028 System prompt helpers for multilingual behavior (depends: T026)
- [x] T029 Multilingual support unit tests (depends: T026, T027, T028, T002)

---

## Phase 2 — Core Engine (depends: Phase 1)

> Detailed specs: [phase2_core_engine.md](phase2_core_engine.md)

### Task 2.1: Conversation Session Management (F6)

- [x] T030 Session CRUD operations (create, get, update) (depends: T013)
- [x] T031 Message persistence (add, get with ordering and limit) (depends: T013)
- [x] T032 Session context loader (recent N messages for LLM) (depends: T030, T031)
- [x] T033 Session-scoped short-term memory (key-value facts) (depends: T030)
- [x] T034 Session management unit tests (depends: T030, T031, T032, T033, T002)

### Task 2.2: Tool Registry and Execution (F5)

- [x] T035 Tool interface and self-registration registry (depends: T015)
- [x] T036 Tool executor with permission scope enforcement (depends: T035)
- [x] T037 searchKnowledgeBase tool implementation (depends: T035, T043, T044)
- [x] T038 [P] lookupRepoInfo tool implementation (depends: T035, T013)
- [x] T039 [P] getEdLightInitiatives tool implementation (depends: T035, T013)
- [x] T040 Tool system unit tests (depends: T035, T036, T037, T038, T039, T002)

### Task 2.3: Knowledge Retrieval (RAG) Pipeline (F3)

- [x] T041 [P] Markdown-aware document chunker (depends: nothing)
- [x] T042 Embedding generation module (batch wrapper over AIProvider) (depends: T023)
- [x] T043 [P] VectorStore interface and InMemoryVectorStore (depends: nothing)
- [x] T044 Retrieval module (query → embed → search → rank) (depends: T042, T043)
- [x] T045 Knowledge ingestion pipeline (chunk → embed → store) (depends: T041, T042, T043)
- [x] T046 RAG pipeline unit tests (depends: T041, T042, T043, T044, T045, T002)

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

- [x] T090 Request ID middleware and JSON envelope helper (depends: T017)
- [x] T091 POST /api/chat endpoint (depends: T090, T063, T018)
- [x] T092 POST /api/chat/stream SSE endpoint (depends: T090, T066)
- [x] T093 GET /api/conversations/[sessionId] endpoint (depends: T090, T030)
- [x] T094 [P] GET /api/health endpoint (depends: T090)
- [x] T096 API layer unit tests (depends: T091, T092, T093, T094, T002)

### Task 4.2: Web Chat Interface (F1)

- [x] T097 Chat container component (message list + input area) (depends: nothing)
- [x] T098 Message input with send functionality (Enter key, loading state) (depends: T097)
- [x] T099 API client service (sendMessage, streamMessage, getConversation) (depends: T091, T092)
- [x] T100 Streaming response rendering (word-by-word tokens) (depends: T097, T099)
- [x] T101 [P] Typing indicator component (animated three dots) (depends: T097)
- [x] T102 Session continuity (localStorage sessionId + history restore) (depends: T097, T099, T093)
- [x] T103 [P] Empty state with suggested questions (4 per language) (depends: T097, T026)
- [x] T104 [P] Language selector component (dropdown: en/fr/ht) (depends: T026)
- [x] T105 Responsive layout (320px minimum, mobile-first) (depends: T097, T098)
- [x] T106 Chat UI component tests (depends: T097, T098, T099, T100, T101, T102, T103, T104, T105)

### Task 4.3: Admin Indexing Controls (F11)

- [x] T107 API key authentication middleware (x-api-key header) (depends: T015, T016)
- [x] T108 GET /api/repos endpoint (list repos with status) (depends: T107, T090, T013)
- [x] T109 POST /api/index endpoint (trigger indexing) (depends: T107, T090, T072)
- [x] T111 Admin endpoints unit tests (depends: T107, T108, T109, T002)

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

---

## V2 — Sandra V2 Scope

> Docs: `docs/releases/v2.md`, `docs/releases/v2_tasks.md`
> Phase docs: `phase1_tool_routing_and_accuracy.md`, `phase2_streaming_and_tool_continuity.md`, `phase3_grounded_platform_knowledge.md`, `phase4_eval_and_release_readiness.md`

**V2 does NOT include:** WhatsApp, Instagram, Email, Voice, autonomous agent actions, complex auth flows.

### V2 Phase 0 — Scope Alignment

- [x] V2-P0 Review roadmap and confirm V2 priorities
- [x] V2-P0 Verify V2 phase docs align with v2.md and v2_tasks.md
- [x] V2-P0 Commit V2 phase docs to .agent/impl_docs/

### V2 Phase 1 — Tool Routing and Response Accuracy

> Detailed spec: `phase1_tool_routing_and_accuracy.md`

- [x] V2-P1-A Route Academy/Code course questions to getCourseInventory (not getEdLightInitiatives)
- [x] V2-P1-B Add benchmark prompts for tool routing verification
- [x] V2-P1-C Add/update tests for routing behavior
- [x] V2-P1-D Validate: npm test, tsc --noEmit, npm run build

### V2 Phase 2 — Streaming and Tool Continuity

> Detailed spec: `phase2_streaming_and_tool_continuity.md`

- [ ] V2-P2-A Preserve assistant tool_calls message before tool result messages in streaming
- [ ] V2-P2-B Ensure follow-up model call includes valid assistant tool_calls context
- [ ] V2-P2-C Add regression tests for streaming tool-call continuity
- [ ] V2-P2-D Validate: npm test, tsc --noEmit, npm run build

### V2 Phase 3 — Grounded Platform Knowledge

> Detailed spec: `phase3_grounded_platform_knowledge.md`

- [x] V2-P3-A Improve course inventory coverage (Academy, Code)
- [x] V2-P3-B Improve repository-backed answers for News and Initiative
- [x] V2-P3-C Ensure Academy/Code/News/Initiative answers are clearly differentiated
- [x] V2-P3-D Validate benchmark prompts return grounded answers

### V2 Phase 4 — Evaluation and Release Readiness

> Detailed spec: `phase4_eval_and_release_readiness.md`

- [ ] V2-P4-A Run full benchmark suite against core EdLight prompts
- [ ] V2-P4-B Verify tool routing correctness across all prompt categories
- [ ] V2-P4-C Verify streaming stability post-tool-call
- [ ] V2-P4-D Final gate: npm test, tsc --noEmit, npm run build all pass
