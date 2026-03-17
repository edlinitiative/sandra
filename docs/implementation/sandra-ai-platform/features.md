# Sandra AI Platform Feature Registry

> Historical planning note: this registry is useful for dependency tracing, but the
> feature status fields below are not the current release truth. For current state,
> use `progress.md` and `docs/releases/v2.md`.

## Overview

12 features organized in 4 phases. Features must be built in dependency order.
Foundation infrastructure first, then core engine, agent and indexing, and finally the interface layer.

## Dependency Diagram

```
Phase 1 — Foundation          Phase 2 — Core Engine       Phase 3 — Agent & Indexing    Phase 4 — Interface
========================      =======================     =========================     ======================

F10: DB Schema ─────────────► F6: Session Mgmt ─────────► F2: Agent Runtime ──────────► F9: API Layer
    │                             │                           ▲    │                        │    │
    │                             │                           │    │                        │    │
    ├─────────────────────────────┼───► F3: RAG Pipeline ─────┼──► F4: Repo Indexing ──────┼──► F11: Admin Controls
    │                             │         ▲                 │                             │
    │                             │         │                 │                             │
F12: Security ──────────────► F5: Tool Registry ─────────────┘                             └──► F1: Web Chat UI
    │                                                                                           ▲
    │                                                                                           │
F8: LLM Provider ──────────────────────────────────────────────────────────────────────────────┘
    │                                                                                    (via F9)
    │
F7: Multilingual ──────────────────────► (used by F2, F9)
```

## Feature List

### F10: Database Schema and Data Layer

- **Priority:** 1
- **Phase:** 1 — Foundation Infrastructure
- **Status:** [ ] Not started
- **Depends on:** None
- **Blocks:** F6, F3, F4
- **User Stories:** US-01
- **Tasks:** T010–T014
- **PRD Reference:** Section 14 (Infrastructure — Database)
- **Key Deliverables:**
  - Finalized Prisma schema with all V1 models (User, Session, Message, Memory, IndexedSource, IndexedDocument, RepoRegistry)
  - Database migrations generated and applied
  - Seed data for four EdLight repositories in RepoRegistry
  - Prisma client generation and typed data access helpers

### F12: Security and Error Handling

- **Priority:** 1
- **Phase:** 1 — Foundation Infrastructure
- **Status:** [ ] Not started
- **Depends on:** None
- **Blocks:** F5, F9
- **User Stories:** US-02
- **Tasks:** T015–T019
- **PRD Reference:** Section 15 (Security and Privacy)
- **Key Deliverables:**
  - SandraError subclasses for all error categories (validation, auth, not-found, provider, tool)
  - Environment secrets validation via Zod at startup
  - Structured logging utility with request ID correlation
  - Zod validation schemas for all API route inputs
  - Input sanitization helpers

### F8: LLM Provider Abstraction

- **Priority:** 1
- **Phase:** 1 — Foundation Infrastructure
- **Status:** [ ] Not started
- **Depends on:** None
- **Blocks:** F2, F3
- **User Stories:** US-03
- **Tasks:** T020–T025
- **PRD Reference:** Section 14 (Infrastructure — AI Model)
- **Key Deliverables:**
  - AIProvider interface with chat completion, tool calling, and streaming methods
  - OpenAI implementation of AIProvider
  - Embedding generation method (text-embedding-3-small)
  - Provider factory with environment-based configuration

### F7: Multilingual Support

- **Priority:** 1
- **Phase:** 1 — Foundation Infrastructure
- **Status:** [ ] Not started
- **Depends on:** None
- **Blocks:** F2, F9
- **User Stories:** US-04
- **Tasks:** T026–T029
- **PRD Reference:** Section 11 (Multilingual Support)
- **Key Deliverables:**
  - Language enum (en, fr, ht) and type definitions
  - Per-request language detection/selection utility
  - System prompt helpers for multilingual agent behavior
  - User language preference storage integration

### F6: Conversation Session Management

- **Priority:** 2
- **Phase:** 2 — Core Engine
- **Status:** [ ] Not started
- **Depends on:** F10
- **Blocks:** F2, F9
- **User Stories:** US-05, US-06
- **Tasks:** T030–T034
- **PRD Reference:** Section 13 (Agent Components — Memory System)
- **Key Deliverables:**
  - Session creation, retrieval, and update operations via Prisma
  - Message persistence with role, content, and metadata
  - Session context loader for agent runtime (recent message history)
  - Session-scoped memory store for short-term context

### F5: Tool Registry and Execution

- **Priority:** 2
- **Phase:** 2 — Core Engine
- **Status:** [ ] Not started
- **Depends on:** F12
- **Blocks:** F2
- **User Stories:** US-07
- **Tasks:** T035–T040
- **PRD Reference:** Section 13 (Agent Components — Tool System)
- **Key Deliverables:**
  - Tool interface with name, description, inputSchema, requiredScopes, handler
  - Self-registering tool registry
  - Permission scope enforcement on tool execution
  - MVP tools: searchKnowledgeBase, getEdLightInitiatives, lookupRepoInfo

### F3: Knowledge Retrieval (RAG) Pipeline

- **Priority:** 2
- **Phase:** 2 — Core Engine
- **Status:** [ ] Not started
- **Depends on:** F8, F10
- **Blocks:** F4, F2 (via searchKnowledgeBase tool)
- **User Stories:** US-08
- **Tasks:** T041–T046
- **PRD Reference:** Section 12 (Knowledge Layer), Section 14 (Knowledge Index)
- **Key Deliverables:**
  - Markdown-aware document chunker with configurable chunk size
  - Embedding generation module using AIProvider
  - VectorStore interface with in-memory implementation
  - Retrieval module: query embedding → similarity search → ranked chunks
  - End-to-end pipeline: chunk → embed → store → retrieve

### F2: Sandra Agent Runtime

- **Priority:** 3
- **Phase:** 3 — Agent and Indexing
- **Status:** [ ] Not started
- **Depends on:** F5, F6, F7, F8
- **Blocks:** F9
- **User Stories:** US-09, US-10, US-11
- **Tasks:** T060–T068
- **PRD Reference:** Section 13 (Sandra Agent System Design)
- **Key Deliverables:**
  - ReAct-style agent loop: input → context → LLM → tool calls → response
  - Session context and memory loading before each turn
  - System prompt construction with language context and tool definitions
  - Tool call execution loop with max-iteration guard
  - Channel-normalized InboundMessage/OutboundMessage types

### F4: Repository Indexing System

- **Priority:** 3
- **Phase:** 3 — Agent and Indexing
- **Status:** [ ] Not started
- **Depends on:** F3
- **Blocks:** F11
- **User Stories:** US-12, US-13
- **Tasks:** T069–T075
- **PRD Reference:** Section 7 (EdLight Ecosystem Integration), Section 8 (Automatic Ecosystem Expansion)
- **Key Deliverables:**
  - GitHub API client for fetching repository documentation files
  - Content fetcher: clone/pull README and docs from configured repos
  - Indexing orchestrator: fetch → chunk → embed → store, with job tracking
  - Content hash tracking to skip unchanged documents
  - IndexedSource and IndexedDocument record management

### F9: API Layer

- **Priority:** 4
- **Phase:** 4 — Interface Layer
- **Status:** [ ] Not started
- **Depends on:** F2, F6, F12
- **Blocks:** F1, F11
- **User Stories:** US-14, US-15
- **Tasks:** T090–T094, T096
- **PRD Reference:** Section 14 (Infrastructure — Backend Server)
- **Key Deliverables:**
  - POST /api/chat — main chat endpoint (accepts message, sessionId, language)
  - GET /api/chat/stream — streaming SSE endpoint for token-by-token delivery
  - GET /api/conversations/[sessionId] — conversation history retrieval
  - GET /api/health — health check endpoint
  - Standard JSON envelope: { success, data, error, meta: { requestId } }
  - Zod input validation on all routes

### F1: Web Chat Interface

- **Priority:** 4
- **Phase:** 4 — Interface Layer
- **Status:** [ ] Not started
- **Depends on:** F9, F8
- **Blocks:** None
- **User Stories:** US-16, US-17, US-18, US-19
- **Tasks:** T097–T106
- **PRD Reference:** Section 5 (Supported Platforms — Web), Section 6 (Conversational AI)
- **Key Deliverables:**
  - Chat container component with message list and input area
  - Streaming response rendering with typing indicator
  - Session continuity (sessionId in client state, restored on reload)
  - Empty state with suggested questions
  - Responsive layout optimized for mobile and desktop
  - Lightweight client JS for low-bandwidth environments

### F11: Admin Indexing Controls

- **Priority:** 4
- **Phase:** 4 — Interface Layer
- **Status:** [ ] Not started
- **Depends on:** F4, F9
- **Blocks:** None
- **User Stories:** US-20, US-21
- **Tasks:** T107–T109, T111
- **PRD Reference:** Section 8 (Automatic Ecosystem Expansion)
- **Key Deliverables:**
  - GET /api/repos — list indexed repositories with status
  - POST /api/index — trigger indexing for a specific repository
  - Indexing job status tracking and reporting
  - API key authentication for admin endpoints
