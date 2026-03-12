# Phase 2: Core Engine

## Prerequisites

- Phase 1 complete: all foundation tests pass
- Database migrated and seeded (`npx prisma migrate deploy && npx prisma db seed`)
- `npx vitest run src/lib/utils/ src/lib/ai/ src/lib/i18n/ src/lib/config/ src/lib/db/` — all pass
- SandraError subclasses, AIProvider, language utilities, and data access helpers available

## Phase Goal

The three core engine features are complete and tested: sessions persist conversations with context loading, tools self-register and execute with permission enforcement, and the RAG pipeline can chunk, embed, store, and retrieve documents.

## Phase Evaluation Criteria

- `npx vitest run src/lib/memory/` — all session management tests pass
- `npx vitest run src/lib/tools/` — all tool registry and execution tests pass
- `npx vitest run src/lib/knowledge/` — all RAG pipeline tests pass
- Session CRUD operations work: create session → add messages → load context (N most recent)
- Tool registry contains 3 MVP tools: searchKnowledgeBase, lookupRepoInfo, getEdLightInitiatives
- Tool execution enforces permission scopes and returns structured errors for failures
- RAG pipeline: chunk a markdown doc → embed chunks → store → query → get ranked results
- `npx tsc --noEmit` passes with no errors
- `npx next lint` passes with no errors

---

## Tasks

### T030: Session CRUD Operations

**PRD Reference:** Section 13 (Memory System)
**Depends on:** T013 (data access helpers)
**Blocks:** T032, T033, T034
**User Stories:** US-05
**Estimated scope:** 1 hour

#### Description

Implement session management service in `src/lib/memory/session-store.ts`. This wraps the data access helpers with business logic for session creation, retrieval, and update.

#### Acceptance Criteria

- [ ] `createSession(params: { channel: string, language?: string, userId?: string })` creates a session and returns it with an ID
- [ ] `getSession(sessionId: string)` returns the session or null
- [ ] `updateSession(sessionId: string, updates)` updates session fields (language, title, isActive)
- [ ] Session IDs are UUIDs
- [ ] New sessions default to `isActive: true` and `language: 'en'`

#### Files to Create/Modify

- `src/lib/memory/session-store.ts` — (modify) implement session CRUD using data access helpers from `src/lib/db/sessions.ts`

#### Implementation Notes

- The file already exists — review the existing `SessionStore` interface and `PrismaSessionStore` class
- Wire `PrismaSessionStore` methods to use the data access helpers from T013
- Generate UUIDs using the `uuid` package (already in dependencies)
- Keep business logic here, raw queries in `src/lib/db/sessions.ts`
- The `SessionStore` interface should be the public API — `PrismaSessionStore` is the implementation

#### Evaluation Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] Session creation returns an object with a UUID id

---

### T031: Message Persistence

**PRD Reference:** Section 13 (Memory System)
**Depends on:** T013 (data access helpers)
**Blocks:** T032, T034
**User Stories:** US-05
**Estimated scope:** 45 min

#### Description

Complete message persistence: saving user and assistant messages to the database with role, content, language, and optional tool call metadata.

#### Acceptance Criteria

- [ ] `addMessage(params: { sessionId, role, content, language?, toolName?, toolCallId?, metadata? })` persists a message
- [ ] `getMessages(sessionId: string, options?: { limit?: number, order?: 'asc' | 'desc' })` returns messages for a session
- [ ] Messages are ordered by `createdAt` ascending by default
- [ ] Tool call messages store `toolName` and `toolCallId`

#### Files to Create/Modify

- `src/lib/memory/session-store.ts` — (modify) add message methods to PrismaSessionStore

#### Implementation Notes

- Use data access helpers from `src/lib/db/messages.ts`
- `addMessage` should validate role is one of: user, assistant, system, tool
- `getMessages` with `limit` is used by the context loader (T032) to get recent messages
- Metadata is a JSON field for extensibility (e.g., token counts, tool results)

#### Evaluation Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] Messages round-trip: add → get returns same content

---

### T032: Session Context Loader

**PRD Reference:** Section 13 (Memory System)
**Depends on:** T030, T031
**Blocks:** T034
**User Stories:** US-06
**Estimated scope:** 45 min

#### Description

Implement a context loader that retrieves the most recent N messages from a session, formatted for the LLM's message array. This is used by the agent runtime before each turn.

#### Acceptance Criteria

- [ ] `loadContext(sessionId: string, maxMessages?: number)` returns an array of `ChatMessage` objects
- [ ] Default `maxMessages` is the `CONTEXT_WINDOW_MESSAGES` constant from config
- [ ] Messages are returned in chronological order (oldest first)
- [ ] Each message maps to `{ role, content }` format expected by the AIProvider
- [ ] Tool messages include `toolCallId` in the mapped output

#### Files to Create/Modify

- `src/lib/memory/session-store.ts` — (modify) add `loadContext` method

#### Implementation Notes

- Query the last N messages ordered by createdAt DESC, then reverse for chronological order
- Map Message records to `ChatMessage` type from `src/lib/ai/types.ts`
- Tool messages need special handling: role='tool' with `tool_call_id` field
- Assistant messages with tool calls should include the tool_calls array
- Use `CONTEXT_WINDOW_MESSAGES` from `src/lib/config/constants.ts` as default limit

#### Evaluation Checklist

- [ ] Context loader returns messages in chronological order
- [ ] Returned format matches `ChatMessage` type

---

### T033: Session-Scoped Short-Term Memory

**PRD Reference:** Section 13 (Memory System)
**Depends on:** T030
**Blocks:** T034
**User Stories:** US-06
**Estimated scope:** 30 min

#### Description

Implement session-scoped short-term memory that stores key-value facts extracted during a conversation (e.g., user's name, topic of interest). This augments the raw message history.

#### Acceptance Criteria

- [ ] `setSessionMemory(sessionId: string, key: string, value: string)` stores a fact
- [ ] `getSessionMemory(sessionId: string)` returns all facts as a key-value map
- [ ] Memory is stored in the Memory table linked to the session's userId (or sessionId if anonymous)
- [ ] Memory entries have a `source` field (default: 'conversation')

#### Files to Create/Modify

- `src/lib/memory/user-memory.ts` — (modify) implement session-scoped memory using Prisma

#### Implementation Notes

- The file already has a `UserMemoryStore` interface — review and ensure session-scoped operations exist
- For V1, session memory is simple key-value storage per session
- Use Prisma `upsert` on `{ userId, key }` to avoid duplicates
- For anonymous sessions (no userId), use sessionId as the key namespace
- This is NOT long-term personalization — it's within-session facts like "user asked about coding"

#### Evaluation Checklist

- [ ] Set and get memory round-trips correctly
- [ ] `npx tsc --noEmit` passes

---

### T034: Session Management Unit Tests

**PRD Reference:** N/A (quality)
**Depends on:** T030, T031, T032, T033, T002
**Blocks:** Nothing
**User Stories:** US-05, US-06
**Estimated scope:** 1 hour

#### Description

Write unit tests for all session management functionality using the mock Prisma client.

#### Acceptance Criteria

- [ ] Session CRUD tests: create, get, update
- [ ] Message persistence tests: add, get with ordering, get with limit
- [ ] Context loader tests: chronological order, respects maxMessages, maps to ChatMessage format
- [ ] Session memory tests: set, get, upsert behavior

#### Files to Create/Modify

- `src/lib/memory/__tests__/session-store.test.ts` — (create) session and message tests
- `src/lib/memory/__tests__/user-memory.test.ts` — (create) session memory tests

#### Implementation Notes

- Mock Prisma client for all tests — no real database calls
- Test context loader with various message counts (0, 1, 20, 50)
- Test that tool messages are mapped correctly with toolCallId
- Verify default maxMessages value comes from config

#### Evaluation Checklist

- [ ] `npx vitest run src/lib/memory/__tests__/` — all tests pass

---

### T035: Tool Interface and Self-Registration Registry

**PRD Reference:** Section 13 (Tool System)
**Depends on:** T015 (error handling)
**Blocks:** T036, T037, T038, T039, T040
**User Stories:** US-07
**Estimated scope:** 1 hour

#### Description

Review and complete the tool registry in `src/lib/tools/registry.ts`. Ensure the `SandraTool` interface is complete and the registry supports self-registration and runtime lookup.

#### Acceptance Criteria

- [ ] `SandraTool` interface: name, description, inputSchema (Zod), requiredScopes (string[]), handler (async function)
- [ ] `ToolRegistry` class: `register(tool)`, `get(name)`, `getAll()`, `getToolDefinitions()` (for LLM)
- [ ] `getToolDefinitions()` returns tools in OpenAI function-calling format: `{ name, description, parameters }`
- [ ] Duplicate tool name registration throws an error
- [ ] Global registry singleton accessible via `getToolRegistry()`

#### Files to Create/Modify

- `src/lib/tools/types.ts` — (modify) finalize SandraTool interface
- `src/lib/tools/registry.ts` — (modify) complete registry implementation
- `src/lib/tools/index.ts` — (modify) export registry and types

#### Implementation Notes

- Files already exist — review and complete
- `inputSchema` is a Zod schema — convert to JSON Schema for `getToolDefinitions()` using `zodToJsonSchema` or a manual converter
- If `zodToJsonSchema` isn't available, write a simple converter for the subset of Zod types used (string, number, boolean, object, enum)
- Handler signature: `(input: unknown, context: ToolContext) => Promise<ToolResult>`
- `ToolContext` includes: sessionId, userId (optional), scopes (string[])
- `ToolResult`: `{ success: boolean, data?: unknown, error?: string }`

#### Evaluation Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] Registry accepts a tool and returns it by name

---

### T036: Tool Executor with Permission Enforcement

**PRD Reference:** Section 13 (Tool System)
**Depends on:** T035
**Blocks:** T040
**User Stories:** US-07
**Estimated scope:** 45 min

#### Description

Complete the tool executor in `src/lib/tools/executor.ts` that runs a tool by name with permission scope checking.

#### Acceptance Criteria

- [ ] `executeTool(name: string, input: unknown, context: ToolContext)` runs the named tool
- [ ] Before execution, validates that `context.scopes` includes all `tool.requiredScopes`
- [ ] Missing scopes throw `AuthError` with details about which scopes are missing
- [ ] Invalid input (fails Zod validation) throws `ValidationError`
- [ ] Tool handler errors are caught and returned as `ToolResult` with `success: false`, not thrown
- [ ] Successful execution returns the tool's `ToolResult`

#### Files to Create/Modify

- `src/lib/tools/executor.ts` — (modify) complete execution with permission and validation logic

#### Implementation Notes

- File already exists — review and complete
- Permission check: `tool.requiredScopes.every(scope => context.scopes.includes(scope))`
- Input validation: `tool.inputSchema.parse(input)` — catch ZodError and wrap in ValidationError
- Handler errors: `try { return await tool.handler(validated, context) } catch (e) { return { success: false, error: e.message } }`
- Log tool execution (name, duration, success/failure) using the structured logger

#### Evaluation Checklist

- [ ] Missing scope rejects with AuthError
- [ ] Invalid input rejects with ValidationError
- [ ] Handler errors return ToolResult, not thrown exceptions

---

### T037: searchKnowledgeBase Tool

**PRD Reference:** Section 12 (Knowledge Layer)
**Depends on:** T035, T043, T044
**Blocks:** T040
**User Stories:** US-08
**Estimated scope:** 45 min

#### Description

Implement the `searchKnowledgeBase` tool that queries the vector store and returns relevant document chunks.

#### Acceptance Criteria

- [ ] Tool name: `searchKnowledgeBase`
- [ ] Input schema: `{ query: string, topK?: number }` (topK defaults to 5)
- [ ] Required scopes: `['knowledge:read']`
- [ ] Handler: embeds query → searches vector store → returns top-K chunks with scores and source metadata
- [ ] Result includes: chunks with content, source URL, similarity score

#### Files to Create/Modify

- `src/lib/tools/search-knowledge.ts` — (modify) complete tool implementation

#### Implementation Notes

- File already exists as a placeholder — wire it to the actual RAG retrieval module
- Use `getAIProvider().generateEmbedding(query)` to embed the query
- Use the retrieval module from `src/lib/knowledge/retrieval.ts` to search
- Format results as an array of `{ content, source, score }` objects
- If vector store is empty, return `{ success: true, data: [] }` with a note

#### Evaluation Checklist

- [ ] Tool is registered in the global registry
- [ ] `npx tsc --noEmit` passes

---

### T038: lookupRepoInfo Tool

**PRD Reference:** Section 7 (EdLight Ecosystem Integration)
**Depends on:** T035, T013
**Blocks:** T040
**User Stories:** US-07
**Estimated scope:** 30 min

#### Description

Implement the `lookupRepoInfo` tool that queries the RepoRegistry to return information about EdLight repositories.

#### Acceptance Criteria

- [ ] Tool name: `lookupRepoInfo`
- [ ] Input schema: `{ repoName?: string }` — optional filter by name
- [ ] Required scopes: `['repos:read']`
- [ ] Handler: queries RepoRegistry → returns repo details (name, description, URL, status)
- [ ] If repoName provided, returns matching repo; otherwise returns all active repos

#### Files to Create/Modify

- `src/lib/tools/lookup-repo.ts` — (modify) complete tool implementation

#### Implementation Notes

- File already exists — wire to data access helpers from `src/lib/db/repos.ts`
- Use `getActiveRepos()` for all repos, or filter by name
- Return: `{ repos: [{ name, displayName, description, url, syncStatus }] }`
- This tool helps Sandra tell users about EdLight platforms and direct them to the right one

#### Evaluation Checklist

- [ ] Tool is registered in the global registry
- [ ] Returns repo data from the database

---

### T039: getEdLightInitiatives Tool

**PRD Reference:** Section 7 (EdLight Ecosystem Integration)
**Depends on:** T035, T013
**Blocks:** T040
**User Stories:** US-07
**Estimated scope:** 30 min

#### Description

Implement the `getEdLightInitiatives` tool that returns information about EdLight programs and initiatives.

#### Acceptance Criteria

- [ ] Tool name: `getEdLightInitiatives`
- [ ] Input schema: `{ category?: string }` — optional filter by category (coding, news, leadership, education)
- [ ] Required scopes: `['repos:read']`
- [ ] Handler: returns a curated list of EdLight initiatives with descriptions and URLs
- [ ] Data sourced from RepoRegistry + hardcoded initiative descriptions for V1

#### Files to Create/Modify

- `src/lib/tools/get-initiatives.ts` — (modify) complete tool implementation

#### Implementation Notes

- File already exists — review and complete
- For V1, initiative data is a combination of RepoRegistry entries and hardcoded descriptions:
  - EdLight Code: coding education platform
  - EdLight News: community news and updates
  - EdLight Initiative: leadership and programs hub
  - EdLight Academy: educational resources
- Map repo categories based on repo name (code → coding, News → news, etc.)
- In V2, this could pull from a dedicated Initiatives table

#### Evaluation Checklist

- [ ] Tool is registered in the global registry
- [ ] Returns initiative data with descriptions

---

### T040: Tool System Unit Tests

**PRD Reference:** N/A (quality)
**Depends on:** T035, T036, T037, T038, T039, T002
**Blocks:** Nothing
**User Stories:** US-07
**Estimated scope:** 1 hour

#### Description

Write unit tests for the tool registry, executor, and all three MVP tools.

#### Acceptance Criteria

- [ ] Registry tests: register, get, getAll, duplicate rejection
- [ ] Executor tests: scope enforcement, input validation, error handling
- [ ] searchKnowledgeBase: returns results from mock vector store
- [ ] lookupRepoInfo: returns repos from mock Prisma
- [ ] getEdLightInitiatives: returns initiative data

#### Files to Create/Modify

- `src/lib/tools/__tests__/registry.test.ts` — (create) registry tests
- `src/lib/tools/__tests__/executor.test.ts` — (create) executor tests
- `src/lib/tools/__tests__/tools.test.ts` — (create) individual tool tests

#### Implementation Notes

- For searchKnowledgeBase tests, mock the AI provider and vector store
- For lookupRepoInfo and getEdLightInitiatives, mock the Prisma client
- Test scope enforcement: call with missing scopes → AuthError
- Test input validation: call with invalid input → ValidationError
- Test error handling: handler that throws → ToolResult with success: false

#### Evaluation Checklist

- [ ] `npx vitest run src/lib/tools/__tests__/` — all tests pass

---

### T041: Markdown-Aware Document Chunker

**PRD Reference:** Section 12 (Knowledge Layer)
**Depends on:** Nothing
**Blocks:** T045, T046
**User Stories:** US-08
**Estimated scope:** 1 hour

#### Description

Review and complete the document chunker at `src/lib/knowledge/chunker.ts`. It should split markdown documents into chunks that preserve heading context.

#### Acceptance Criteria

- [ ] `chunkDocument(content: string, options?: ChunkOptions)` returns `DocumentChunk[]`
- [ ] `ChunkOptions`: `{ chunkSize?: number, chunkOverlap?: number }` with defaults from constants
- [ ] Chunks split on markdown boundaries: headings (`#`), paragraph breaks (`\n\n`), then sentence boundaries
- [ ] Each chunk includes metadata: `{ headingContext: string, chunkIndex: number, chunkTotal: number }`
- [ ] `headingContext` contains the most recent heading(s) above the chunk content
- [ ] No chunk exceeds `chunkSize` characters (with some tolerance for heading context)

#### Files to Create/Modify

- `src/lib/knowledge/chunker.ts` — (modify) complete markdown-aware chunking
- `src/lib/knowledge/types.ts` — (modify) ensure `DocumentChunk` type is defined

#### Implementation Notes

- File already exists — review the existing implementation
- Recursive splitting strategy: try heading splits first, then paragraph splits, then sentence splits
- Track current heading context as you walk through the document
- Use `CHUNK_SIZE` (1000) and `CHUNK_OVERLAP` (200) from config constants
- Overlap: each chunk includes the last `chunkOverlap` characters from the previous chunk
- `DocumentChunk`: `{ content: string, metadata: { headingContext, chunkIndex, chunkTotal, sourceId? } }`

#### Evaluation Checklist

- [ ] A 3000-char markdown doc with headings produces 3-4 chunks
- [ ] Each chunk has headingContext from the nearest heading above it

---

### T042: Embedding Generation Module

**PRD Reference:** Section 12 (Knowledge Layer), Section 14 (AI Model)
**Depends on:** T023 (AI provider embedding)
**Blocks:** T045, T046
**User Stories:** US-08
**Estimated scope:** 30 min

#### Description

Review and complete the embedding module at `src/lib/knowledge/embeddings.ts` that wraps the AIProvider's embedding method for batch document processing.

#### Acceptance Criteria

- [ ] `embedText(text: string)` returns `Promise<number[]>` — a single embedding
- [ ] `embedChunks(chunks: DocumentChunk[])` returns chunks with embeddings attached
- [ ] Uses `getAIProvider().generateEmbedding()` under the hood
- [ ] Handles empty text gracefully (returns zero vector or skips)

#### Files to Create/Modify

- `src/lib/knowledge/embeddings.ts` — (modify) complete embedding module

#### Implementation Notes

- File already exists — review and wire to AI provider
- `embedChunks` iterates over chunks and calls `embedText` for each
- For V1, sequential embedding is fine (no batching needed with 4 repos)
- Consider adding a simple rate limiter (100ms delay between calls) to avoid API rate limits
- Return type: `EmbeddedChunk = DocumentChunk & { embedding: number[] }`

#### Evaluation Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] `embedText('hello')` calls `getAIProvider().generateEmbedding('hello')`

---

### T043: VectorStore Interface and InMemoryVectorStore

**PRD Reference:** Section 14 (Knowledge Index)
**Depends on:** Nothing
**Blocks:** T037, T044, T046
**User Stories:** US-08
**Estimated scope:** 1 hour

#### Description

Review and complete the vector store abstraction at `src/lib/knowledge/vector-store.ts`. Ensure the `VectorStore` interface is clean and the `InMemoryVectorStore` implementation works correctly with cosine similarity.

#### Acceptance Criteria

- [ ] `VectorStore` interface: `addDocuments(docs: EmbeddedChunk[])`, `search(queryEmbedding: number[], topK: number): ScoredChunk[]`, `clear()`, `size(): number`
- [ ] `InMemoryVectorStore` stores documents in an array and searches with cosine similarity
- [ ] `search` returns results sorted by similarity score descending
- [ ] `ScoredChunk` includes: chunk content, metadata, similarity score
- [ ] `getVectorStore()` factory returns a singleton instance

#### Files to Create/Modify

- `src/lib/knowledge/vector-store.ts` — (modify) complete interface and implementation
- `src/lib/knowledge/types.ts` — (modify) ensure VectorStore types are defined

#### Implementation Notes

- File already exists — review the cosine similarity implementation
- Cosine similarity: `dot(a, b) / (magnitude(a) * magnitude(b))`
- Store documents as `{ chunk, embedding }` pairs in a plain array
- Search: compute similarity of query embedding against all stored embeddings, sort, return top-K
- `clear()` empties the store — used when re-indexing
- Thread safety is not a concern for in-memory store in Node.js (single-threaded)

#### Evaluation Checklist

- [ ] Add 3 documents, search returns them ranked by similarity
- [ ] `size()` returns correct count after add/clear

---

### T044: Retrieval Module

**PRD Reference:** Section 12 (Knowledge Layer)
**Depends on:** T042, T043
**Blocks:** T037, T046
**User Stories:** US-08
**Estimated scope:** 45 min

#### Description

Complete the retrieval module at `src/lib/knowledge/retrieval.ts` that provides a high-level search API: takes a text query, embeds it, searches the vector store, and returns ranked results.

#### Acceptance Criteria

- [ ] `retrieveRelevant(query: string, options?: { topK?: number })` returns `RetrievalResult[]`
- [ ] Process: embed query → search vector store → return scored chunks with source metadata
- [ ] `RetrievalResult`: `{ content: string, source: string, score: number, metadata: ChunkMetadata }`
- [ ] Default topK from `TOP_K_RESULTS` constant
- [ ] Returns empty array if vector store is empty (no error)

#### Files to Create/Modify

- `src/lib/knowledge/retrieval.ts` — (modify) complete retrieval implementation

#### Implementation Notes

- File already exists — review and wire to embedding module and vector store
- Use `embedText(query)` from T042 to get query embedding
- Use `getVectorStore().search(queryEmbedding, topK)` to search
- Map `ScoredChunk` to `RetrievalResult` format
- Log retrieval queries and result counts using structured logger

#### Evaluation Checklist

- [ ] `retrieveRelevant('test query')` returns an array
- [ ] Empty vector store returns `[]` without error

---

### T045: Knowledge Ingestion Pipeline

**PRD Reference:** Section 12 (Knowledge Layer)
**Depends on:** T041, T042, T043
**Blocks:** T046
**User Stories:** US-08
**Estimated scope:** 45 min

#### Description

Complete the ingestion pipeline at `src/lib/knowledge/ingest.ts` that takes raw document content and processes it through the full pipeline: chunk → embed → store.

#### Acceptance Criteria

- [ ] `ingestDocument(params: { content: string, source: string, sourceId?: string })` processes a document
- [ ] Pipeline: chunk document → embed chunks → add to vector store
- [ ] Returns: `{ chunksCreated: number, source: string }`
- [ ] `ingestDocuments(docs: DocumentInput[])` processes multiple documents sequentially
- [ ] Each chunk stores source metadata for attribution

#### Files to Create/Modify

- `src/lib/knowledge/ingest.ts` — (modify) complete ingestion pipeline

#### Implementation Notes

- File already exists — review and wire together chunker, embeddings, and vector store
- `DocumentInput`: `{ content: string, source: string, sourceId?: string, title?: string }`
- For each document: chunk → embed each chunk → add embedded chunks to vector store
- Add source metadata to each chunk before embedding: `{ source, sourceId, title }`
- Log ingestion progress: "Ingesting document {title}: {chunkCount} chunks"

#### Evaluation Checklist

- [ ] Ingesting a document increases vector store size
- [ ] Chunks in the store have source metadata

---

### T046: RAG Pipeline Unit Tests

**PRD Reference:** N/A (quality)
**Depends on:** T041, T042, T043, T044, T045, T002
**Blocks:** Nothing
**User Stories:** US-08
**Estimated scope:** 1 hour 30 min

#### Description

Write unit tests for the complete RAG pipeline: chunker, embeddings, vector store, retrieval, and ingestion.

#### Acceptance Criteria

- [ ] Chunker tests: markdown splitting, heading context preservation, chunk size limits, overlap
- [ ] Vector store tests: add, search, clear, cosine similarity correctness
- [ ] Retrieval tests: query returns ranked results, empty store returns []
- [ ] Ingestion tests: end-to-end document processing
- [ ] Embedding tests: delegates to AI provider (mocked)

#### Files to Create/Modify

- `src/lib/knowledge/__tests__/chunker.test.ts` — (create) chunker tests
- `src/lib/knowledge/__tests__/vector-store.test.ts` — (create) vector store tests
- `src/lib/knowledge/__tests__/retrieval.test.ts` — (create) retrieval tests
- `src/lib/knowledge/__tests__/ingest.test.ts` — (create) ingestion tests

#### Implementation Notes

- For chunker tests: use real markdown content with headings, test chunk count and heading context
- For vector store tests: use simple fake embeddings (e.g., `[1, 0, 0]`, `[0, 1, 0]`) to verify cosine similarity
- For retrieval tests: mock the embedding module and vector store
- For ingestion tests: mock chunker, embeddings, and vector store — verify the pipeline connects them
- Test edge cases: empty document, very short document (one chunk), document with no headings

#### Evaluation Checklist

- [ ] `npx vitest run src/lib/knowledge/__tests__/` — all tests pass
- [ ] Cosine similarity test: `[1,0,0]` is most similar to `[1,0,0]`, less to `[0,1,0]`
