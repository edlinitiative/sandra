# Phase 3: Agent & Indexing

## Prerequisites

- Phase 2 complete: all core engine tests pass
- `npx vitest run src/lib/memory/ src/lib/tools/ src/lib/knowledge/` — all pass
- Session management creates/loads sessions with context
- Tool registry has 3 registered MVP tools
- RAG pipeline can ingest and retrieve documents
- AIProvider is functional with chat completion, streaming, and embedding

## Infrastructure Updates Required

### IU-1: Add Tool Definitions Export to Tool Registry

**File:** `src/lib/tools/registry.ts`

The agent runtime needs to pass tool definitions to the LLM. The registry's `getToolDefinitions()` must return the format the AIProvider expects.

```typescript
// Ensure getToolDefinitions() returns array of:
interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema from Zod
}
```

**Tests:** Verify `getToolDefinitions()` returns correct format in existing registry tests.

### IU-2: Add Session Language to Session Store

**File:** `src/lib/memory/session-store.ts`

The agent runtime needs to read and update the session's language. Ensure `getSession()` returns the `language` field and `updateSession()` can modify it.

**Tests:** Add assertion in session store tests that `getSession()` includes `language`.

## Phase Goal

The Sandra agent runtime is fully functional — it accepts user messages, loads context, calls the LLM with tools, executes tool calls in a ReAct loop, and returns responses. Repository indexing fetches GitHub content through the RAG pipeline into the vector store.

## Phase Evaluation Criteria

- `npx vitest run src/lib/agents/` — all agent runtime tests pass
- `npx vitest run src/lib/channels/` — channel type tests pass
- `npx vitest run src/lib/github/` — indexing tests pass
- Agent processes a message: input → context load → LLM call → response (mocked LLM)
- Agent executes a tool call: LLM returns tool_call → executor runs → result fed back → final response
- Agent respects max-iteration guard (stops after 5 loops)
- Indexing fetches repo content → chunks → embeds → stores in vector store
- Re-indexing skips unchanged documents (content hash match)
- `npx tsc --noEmit` passes with no errors
- `npx next lint` passes with no errors

---

## Tasks

### T060: Channel Message Types

**PRD Reference:** Section 12 (Interface Layer)
**Depends on:** Nothing
**Blocks:** T062, T068
**User Stories:** US-09
**Estimated scope:** 30 min

#### Description

Review and finalize the channel message types in `src/lib/channels/types.ts`. These are the normalized message formats that all channels (web, WhatsApp, etc.) convert to/from.

#### Acceptance Criteria

- [ ] `InboundMessage` type: `{ content: string, sessionId?: string, language?: Language, channel: string, userId?: string, metadata?: Record<string, unknown> }`
- [ ] `OutboundMessage` type: `{ content: string, sessionId: string, language: Language, metadata?: Record<string, unknown> }`
- [ ] `ChannelAdapter` interface: `normalize(raw: unknown): InboundMessage`, `format(response: OutboundMessage): unknown`
- [ ] Web channel adapter implements `ChannelAdapter` for HTTP request/response

#### Files to Create/Modify

- `src/lib/channels/types.ts` — (modify) finalize message types
- `src/lib/channels/web.ts` — (modify) ensure web adapter implements ChannelAdapter

#### Implementation Notes

- Files already exist — review and ensure types are complete
- V1 only implements the web channel, but the types support all future channels
- `InboundMessage` is what the agent runtime receives
- `OutboundMessage` is what the agent runtime returns
- Web adapter normalizes from HTTP POST body to InboundMessage

#### Evaluation Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] InboundMessage and OutboundMessage types are exported

---

### T061: System Prompt Builder

**PRD Reference:** Section 13 (Agent System)
**Depends on:** T028 (multilingual prompts), T035 (tool registry)
**Blocks:** T062, T068
**User Stories:** US-09, US-11
**Estimated scope:** 1 hour

#### Description

Complete the system prompt builder in `src/lib/agents/prompts.ts` that constructs the full system prompt for the Sandra agent, including persona, language instructions, tool descriptions, and behavioral guidelines.

#### Acceptance Criteria

- [ ] `buildSystemPrompt(params: { language: Language, tools: ToolDefinition[], context?: string })` returns a complete system prompt string
- [ ] Prompt includes Sandra persona: "You are Sandra, an AI assistant for the EdLight ecosystem..."
- [ ] Prompt includes language instruction from `getLanguageInstruction(lang)`
- [ ] Prompt includes available tool descriptions (name and what each does)
- [ ] Prompt includes behavioral guidelines: be helpful, reference EdLight platforms, don't fabricate
- [ ] Prompt includes optional context (e.g., user memory summary)

#### Files to Create/Modify

- `src/lib/agents/prompts.ts` — (modify) complete system prompt builder

#### Implementation Notes

- File already exists — review and integrate components from Phase 1 (language helpers, tool definitions)
- Prompt structure:
  1. Persona description (who Sandra is, what EdLight is)
  2. Language instruction ("Respond in {language}")
  3. Available tools section (list tool names/descriptions)
  4. Behavioral guidelines (accuracy, grounding, helpfulness)
  5. Optional context section (user memory, session notes)
- Keep total prompt under ~2000 tokens to leave room for conversation context
- EdLight platform descriptions: Code (coding education), News (community updates), Initiative (leadership programs), Academy (educational resources)

#### Evaluation Checklist

- [ ] System prompt contains persona description
- [ ] System prompt contains language instruction
- [ ] System prompt lists tool names when tools are provided

---

### T062: Context Assembly Module

**PRD Reference:** Section 13 (Agent System)
**Depends on:** T032 (context loader), T033 (session memory), T061
**Blocks:** T063
**User Stories:** US-09, US-10
**Estimated scope:** 45 min

#### Description

Create a context assembly module that gathers all context needed for an agent turn: session history, user memory summary, and system prompt. This is the "build context" step of the ReAct loop.

#### Acceptance Criteria

- [ ] `assembleContext(params: { sessionId: string, language: Language })` returns `AgentContext`
- [ ] `AgentContext` includes: systemPrompt (string), messageHistory (ChatMessage[]), tools (ToolDefinition[])
- [ ] Message history loaded from session store (most recent N)
- [ ] User memory summary appended to system prompt if available
- [ ] Tool definitions loaded from the tool registry

#### Files to Create/Modify

- `src/lib/agents/context.ts` — (create) context assembly module
- `src/lib/agents/types.ts` — (modify) add `AgentContext` type

#### Implementation Notes

- This module orchestrates: session store (load messages) + user memory (get summary) + tool registry (get definitions) + prompt builder (build system prompt)
- The assembled context is passed to the agent loop — it doesn't call the LLM itself
- Memory summary is a brief string like "User is interested in coding. Previously asked about scholarships."
- If session doesn't exist, return empty message history and default context

#### Evaluation Checklist

- [ ] `assembleContext` returns all three fields
- [ ] Message history respects the context window limit

---

### T063: ReAct Agent Loop Core

**PRD Reference:** Section 13 (Agent System — Orchestration Engine)
**Depends on:** T062, T036 (tool executor), T021 (chat completion)
**Blocks:** T064, T065, T068
**User Stories:** US-09, US-10
**Estimated scope:** 2 hours

#### Description

Complete the core ReAct agent loop in `src/lib/agents/sandra.ts`. This is the main orchestration: assemble context → call LLM → if tool calls, execute and loop → return final response.

#### Acceptance Criteria

- [ ] `runSandraAgent(input: InboundMessage)` returns `OutboundMessage`
- [ ] Step 1: Create or retrieve session from sessionId
- [ ] Step 2: Save user message to session
- [ ] Step 3: Assemble context (system prompt, history, tools)
- [ ] Step 4: Call LLM with messages and tool definitions
- [ ] Step 5: If LLM returns tool calls → execute each → append results → go to Step 4
- [ ] Step 6: If LLM returns text response → save to session → return OutboundMessage
- [ ] Max iterations guard: stop after `MAX_AGENT_ITERATIONS` loops (default 5)
- [ ] On max iterations: return a graceful "I need more time" message

#### Files to Create/Modify

- `src/lib/agents/sandra.ts` — (modify) complete the agent loop

#### Implementation Notes

- The file already has a substantial implementation — review, test, and complete
- The ReAct loop is the heart of the system:
  ```
  messages = [systemPrompt, ...history, userMessage]
  for (i = 0; i < MAX_ITERATIONS; i++) {
    result = await provider.chatCompletion({ messages, tools })
    if (result.toolCalls.length === 0) return result.content
    for (toolCall of result.toolCalls) {
      toolResult = await executeTool(toolCall.name, JSON.parse(toolCall.arguments), context)
      messages.push({ role: 'assistant', content: null, toolCalls: [toolCall] })
      messages.push({ role: 'tool', content: JSON.stringify(toolResult), toolCallId: toolCall.id })
    }
  }
  ```
- Resolve language using `resolveLanguage({ explicit: input.language, sessionLanguage: session.language })`
- Use structured logging for each step: "Agent turn started", "Calling LLM", "Executing tool: {name}", "Agent turn complete"
- Track token usage across iterations for monitoring

#### Evaluation Checklist

- [ ] Agent returns a text response for a simple message (no tool calls)
- [ ] Agent executes tool calls and incorporates results
- [ ] Agent stops at max iterations

---

### T064: Tool Call Execution Within Agent Loop

**PRD Reference:** Section 13 (Tool System)
**Depends on:** T063, T036
**Blocks:** T068
**User Stories:** US-10
**Estimated scope:** 45 min

#### Description

Ensure tool call execution within the agent loop correctly parses tool call arguments, invokes the executor, and formats results for the LLM.

#### Acceptance Criteria

- [ ] Tool call arguments (JSON string from LLM) are parsed safely
- [ ] Tool executor is called with parsed input and appropriate context (sessionId, scopes)
- [ ] Tool results are serialized back to string for the LLM
- [ ] Failed tool calls return a structured error message to the LLM (not crash the agent)
- [ ] Multiple tool calls in a single LLM response are executed sequentially

#### Files to Create/Modify

- `src/lib/agents/sandra.ts` — (modify) refine tool execution within the loop

#### Implementation Notes

- Parse tool arguments with `JSON.parse()` wrapped in try-catch
- Invalid JSON → return error to LLM: "Tool call failed: invalid arguments"
- Build `ToolContext` with: `{ sessionId: session.id, scopes: ['knowledge:read', 'repos:read'] }`
- For V1, all public chat users get the same scopes (no user-specific permissions)
- Format tool result for LLM: `JSON.stringify(toolResult.data)` or `toolResult.error`

#### Evaluation Checklist

- [ ] Invalid JSON arguments don't crash the agent
- [ ] Tool errors are fed back to the LLM as context

---

### T065: Max-Iteration Guard and Error Recovery

**PRD Reference:** Section 13 (Agent System)
**Depends on:** T063
**Blocks:** T068
**User Stories:** US-10
**Estimated scope:** 30 min

#### Description

Implement robust error handling and the max-iteration guard for the agent loop.

#### Acceptance Criteria

- [ ] After `MAX_AGENT_ITERATIONS` tool-calling loops, return a fallback message
- [ ] Fallback message: "I'm having trouble completing this request. Let me try to help differently."
- [ ] LLM provider errors (ProviderError) are caught and return a user-friendly error message
- [ ] Unexpected errors are caught, logged, and return a generic error message
- [ ] All errors are logged with request context (sessionId, iteration count, error details)

#### Files to Create/Modify

- `src/lib/agents/sandra.ts` — (modify) add error handling and iteration guard

#### Implementation Notes

- Wrap the entire agent loop in try-catch
- Log errors at ERROR level with full context
- For ProviderError: "I'm temporarily unable to process your request. Please try again."
- For unexpected errors: "Something went wrong. Please try again later."
- Always save the error message to the session as an assistant message (for conversation continuity)

#### Evaluation Checklist

- [ ] Agent returns graceful message at max iterations
- [ ] Provider errors don't crash the agent

---

### T066: Agent Streaming Support

**PRD Reference:** Section 14 (Backend Server)
**Depends on:** T063, T022 (streaming)
**Blocks:** T068
**User Stories:** US-10
**Estimated scope:** 1 hour

#### Description

Add a streaming variant of the agent that yields tokens as they arrive from the LLM. This powers the SSE endpoint.

#### Acceptance Criteria

- [ ] `runSandraAgentStream(input: InboundMessage)` returns `AsyncIterable<AgentStreamEvent>`
- [ ] `AgentStreamEvent`: `{ type: 'token' | 'tool_call' | 'tool_result' | 'done' | 'error', data: string }`
- [ ] Token events stream content as it arrives from the LLM
- [ ] Tool calls pause streaming, execute, then resume with next LLM call
- [ ] Done event includes the final sessionId
- [ ] Error events include user-friendly error messages

#### Files to Create/Modify

- `src/lib/agents/sandra.ts` — (modify) add streaming agent function
- `src/lib/agents/types.ts` — (modify) add `AgentStreamEvent` type

#### Implementation Notes

- Use `async function*` generator pattern
- The streaming variant follows the same ReAct loop but uses `streamChatCompletion` instead of `chatCompletion`
- When tool calls are detected during streaming, switch to non-streaming for the tool execution, then stream the next LLM response
- Yield `{ type: 'tool_call', data: toolName }` when starting tool execution
- Yield `{ type: 'tool_result', data: JSON.stringify(result) }` after tool completes
- After the final text response streams completely, yield `{ type: 'done', data: sessionId }`

#### Evaluation Checklist

- [ ] Streaming variant yields token events
- [ ] Tool calls pause and resume streaming correctly

---

### T067: Agent Runtime Unit Tests

**PRD Reference:** N/A (quality)
**Depends on:** T063, T064, T065, T002
**Blocks:** Nothing
**User Stories:** US-09, US-10, US-11
**Estimated scope:** 1 hour 30 min

#### Description

Write comprehensive unit tests for the Sandra agent runtime using mocked dependencies.

#### Acceptance Criteria

- [ ] Test: simple message → LLM response (no tool calls)
- [ ] Test: message triggers tool call → tool result → final response
- [ ] Test: multiple tool calls in sequence
- [ ] Test: max iteration guard triggers after N loops
- [ ] Test: LLM provider error → graceful error message
- [ ] Test: invalid tool call arguments → error fed back to LLM
- [ ] Test: context assembly includes session history and tools

#### Files to Create/Modify

- `src/lib/agents/__tests__/sandra.test.ts` — (create) agent runtime tests
- `src/lib/agents/__tests__/context.test.ts` — (create) context assembly tests
- `src/lib/agents/__tests__/prompts.test.ts` — (create) prompt builder tests

#### Implementation Notes

- Mock all dependencies: AIProvider, SessionStore, ToolRegistry, ToolExecutor
- For the simple case: mock LLM returns `{ content: 'Hello!', toolCalls: [] }`
- For tool call case: first LLM call returns tool_call, second returns text
- For max iterations: mock LLM always returns tool_calls → verify loop stops at MAX_AGENT_ITERATIONS
- Verify session messages are saved (user message in, assistant message out)

#### Evaluation Checklist

- [ ] `npx vitest run src/lib/agents/__tests__/` — all tests pass

---

### T068: Agent Integration Test

**PRD Reference:** N/A (quality)
**Depends on:** T063, T064, T065, T066, T060
**Blocks:** Nothing
**User Stories:** US-09, US-10, US-11
**Estimated scope:** 1 hour

#### Description

Write an integration test that exercises the full agent pipeline with a mock LLM but real tool registry and session store (using mock Prisma).

#### Acceptance Criteria

- [ ] Test: full pipeline — InboundMessage → agent → OutboundMessage with session persistence
- [ ] Test: agent uses searchKnowledgeBase tool when LLM requests it
- [ ] Test: streaming variant yields events in correct order
- [ ] Test: session context is loaded and passed to LLM on follow-up messages

#### Files to Create/Modify

- `src/lib/agents/__tests__/integration.test.ts` — (create) integration tests

#### Implementation Notes

- Use mock AIProvider that returns scripted responses (tool calls on first call, text on second)
- Use real ToolRegistry with MVP tools registered (but mock their data dependencies)
- Verify the end-to-end flow: message in → session created → LLM called with context → tool executed → response returned
- For streaming test: collect all events from the async iterable and verify sequence
- This test validates the wiring between components — not individual component behavior

#### Evaluation Checklist

- [ ] `npx vitest run src/lib/agents/__tests__/integration.test.ts` passes

---

### T069: GitHub API Client

**PRD Reference:** Section 7 (EdLight Ecosystem Integration)
**Depends on:** T016 (env config for GITHUB_TOKEN)
**Blocks:** T070, T075
**User Stories:** US-12
**Estimated scope:** 45 min

#### Description

Review and complete the GitHub API client at `src/lib/github/client.ts`. Ensure it supports authenticated requests and handles rate limiting.

#### Acceptance Criteria

- [ ] `GitHubClient` class with authenticated Octokit or fetch-based requests
- [ ] `getRepoContents(owner: string, repo: string, path: string)` returns file listing
- [ ] `getFileContent(owner: string, repo: string, path: string)` returns file content as string
- [ ] Authentication via GITHUB_TOKEN from environment
- [ ] Rate limit errors are caught and wrapped in `ProviderError` with retry-after hint

#### Files to Create/Modify

- `src/lib/github/client.ts` — (modify) complete GitHub API client
- `src/lib/github/types.ts` — (modify) ensure types are complete

#### Implementation Notes

- File already exists — review and complete
- Use fetch with `Authorization: Bearer ${GITHUB_TOKEN}` header (simpler than Octokit for our needs)
- GitHub API base: `https://api.github.com`
- Contents endpoint: `GET /repos/{owner}/{repo}/contents/{path}`
- File content comes base64-encoded — decode with `Buffer.from(content, 'base64').toString('utf-8')`
- Handle 404 (repo/file not found) → return null
- Handle 403 (rate limit) → throw ProviderError with retry-after

#### Evaluation Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] Client methods have correct return types

---

### T070: Repository Content Fetcher

**PRD Reference:** Section 7 (EdLight Ecosystem Integration)
**Depends on:** T069, T013 (repo data access)
**Blocks:** T072, T075
**User Stories:** US-12
**Estimated scope:** 1 hour

#### Description

Complete the content fetcher at `src/lib/github/fetcher.ts` that retrieves documentation files from a GitHub repository.

#### Acceptance Criteria

- [ ] `fetchRepoDocuments(repo: RepoRegistryRecord)` returns `FetchedDocument[]`
- [ ] `FetchedDocument`: `{ path: string, content: string, url: string }`
- [ ] Fetches README.md from repo root
- [ ] Fetches all .md files from the repo's configured `docsPath`
- [ ] Skips non-markdown files
- [ ] Handles missing files/paths gracefully (log warning, continue)

#### Files to Create/Modify

- `src/lib/github/fetcher.ts` — (modify) complete document fetching logic

#### Implementation Notes

- File already exists — review and complete
- Flow: get repo config from RepoRegistry → list files at docsPath → filter .md files → fetch content for each
- Use `GitHubClient.getRepoContents()` to list directory
- Use `GitHubClient.getFileContent()` to fetch each file
- Construct source URL: `https://github.com/{owner}/{repo}/blob/{branch}/{path}`
- If docsPath is empty or doesn't exist, fall back to just the README

#### Evaluation Checklist

- [ ] Fetcher returns an array of documents with content
- [ ] Non-markdown files are skipped

---

### T071: Content Hash and Change Detection

**PRD Reference:** Section 8 (Automatic Ecosystem Expansion)
**Depends on:** T013 (document data access)
**Blocks:** T072, T075
**User Stories:** US-13
**Estimated scope:** 30 min

#### Description

Implement content hash computation for detecting unchanged documents during re-indexing.

#### Acceptance Criteria

- [ ] `computeContentHash(content: string)` returns a SHA-256 hex string
- [ ] `hasContentChanged(sourceId: string, path: string, newHash: string)` checks against stored hash
- [ ] Returns `true` if no stored hash exists (new document)
- [ ] Returns `false` if stored hash matches (unchanged)

#### Files to Create/Modify

- `src/lib/github/indexer.ts` — (modify) add content hash utilities

#### Implementation Notes

- Use Node.js built-in `crypto.createHash('sha256').update(content).digest('hex')`
- Query `IndexedDocument` by sourceId and path to find existing hash
- Use data access helper `getDocumentByHash()` from `src/lib/db/documents.ts`
- This is used by the indexing orchestrator to skip unchanged documents

#### Evaluation Checklist

- [ ] Same content produces same hash
- [ ] Different content produces different hash

---

### T072: Indexing Orchestrator

**PRD Reference:** Section 8 (Automatic Ecosystem Expansion)
**Depends on:** T070, T071, T045 (ingestion pipeline)
**Blocks:** T073, T074, T075
**User Stories:** US-12, US-13
**Estimated scope:** 1 hour 30 min

#### Description

Complete the indexing orchestrator at `src/lib/github/indexer.ts` that coordinates the full indexing workflow: fetch repo documents → check for changes → process through RAG pipeline → track records.

#### Acceptance Criteria

- [ ] `indexRepository(repoId: string)` runs the full indexing pipeline for a repository
- [ ] Step 1: Look up repo in RepoRegistry, set syncStatus to 'indexing'
- [ ] Step 2: Fetch documents using the content fetcher
- [ ] Step 3: For each document, compute hash and check for changes
- [ ] Step 4: For changed/new documents, run through ingestion pipeline (chunk → embed → store)
- [ ] Step 5: Create/update IndexedSource and IndexedDocument records
- [ ] Step 6: Set syncStatus to 'indexed' (or 'error' on failure)
- [ ] Returns: `IndexingResult` with counts of: processed, skipped, failed

#### Files to Create/Modify

- `src/lib/github/indexer.ts` — (modify) complete indexing orchestrator

#### Implementation Notes

- File already exists — review and complete
- Use `updateRepoSyncStatus()` from data access helpers to track state
- Create `IndexedSource` record for each repo being indexed (or update existing)
- For each document: create `IndexedDocument` with content, path, contentHash, chunkIndex, chunkTotal
- On re-index: delete old IndexedDocuments for the source before inserting new ones (simple replace strategy)
- Wrap entire operation in try-catch: set syncStatus to 'error' on failure
- Log progress: "Indexing {repo}: {n} documents found, {m} changed, {k} skipped"

#### Evaluation Checklist

- [ ] Indexing a repo updates its syncStatus through the lifecycle
- [ ] Skipped documents are detected by content hash

---

### T073: IndexedSource and IndexedDocument Management

**PRD Reference:** Section 8 (Automatic Ecosystem Expansion)
**Depends on:** T072
**Blocks:** T075
**User Stories:** US-12
**Estimated scope:** 30 min

#### Description

Ensure IndexedSource and IndexedDocument records are properly managed during indexing: created, updated, and cleaned up.

#### Acceptance Criteria

- [ ] `createOrUpdateSource(params)` upserts an IndexedSource record
- [ ] `saveIndexedDocuments(sourceId, documents[])` bulk creates IndexedDocument records
- [ ] `deleteDocumentsForSource(sourceId)` removes all documents for a source (for re-indexing)
- [ ] Source record tracks: documentCount, lastIndexedAt, status

#### Files to Create/Modify

- `src/lib/db/documents.ts` — (modify) add source and document management helpers
- `src/lib/db/index.ts` — (modify) re-export new helpers

#### Implementation Notes

- Use `prisma.indexedSource.upsert()` keyed on unique identifier (url or name+type)
- `saveIndexedDocuments` uses `prisma.indexedDocument.createMany()` for efficiency
- `deleteDocumentsForSource` uses `prisma.indexedDocument.deleteMany({ where: { sourceId } })`
- Update source's `documentCount` after saving documents

#### Evaluation Checklist

- [ ] Source upsert creates on first call, updates on second
- [ ] Document deletion removes all documents for a source

---

### T074: Indexing Job Status Tracking

**PRD Reference:** Section 8 (Automatic Ecosystem Expansion)
**Depends on:** T072
**Blocks:** T075
**User Stories:** US-13
**Estimated scope:** 30 min

#### Description

Implement a simple indexing job status tracker that records the progress and result of each indexing operation.

#### Acceptance Criteria

- [ ] `IndexingResult` type: `{ repoId, status: 'completed' | 'failed', documentsProcessed, documentsSkipped, documentsFailed, startedAt, completedAt, error? }`
- [ ] Indexing orchestrator returns `IndexingResult` on completion
- [ ] Result data is available for the API layer to return to admin clients
- [ ] Failed indexing includes error message in the result

#### Files to Create/Modify

- `src/lib/github/types.ts` — (modify) add `IndexingResult` type
- `src/lib/github/indexer.ts` — (modify) return `IndexingResult` from `indexRepository()`

#### Implementation Notes

- For V1, store the latest result in memory (no persistent job table)
- `startedAt = new Date()` at the beginning, `completedAt = new Date()` at the end
- The API layer (Phase 4) will call `indexRepository()` and return the result
- Consider a simple in-memory map: `Map<string, IndexingResult>` keyed by repoId

#### Evaluation Checklist

- [ ] `indexRepository()` returns an IndexingResult with all fields populated

---

### T075: Repository Indexing Unit Tests

**PRD Reference:** N/A (quality)
**Depends on:** T069, T070, T071, T072, T073, T074, T002
**Blocks:** Nothing
**User Stories:** US-12, US-13
**Estimated scope:** 1 hour 30 min

#### Description

Write unit tests for the repository indexing system using mocked GitHub API and Prisma.

#### Acceptance Criteria

- [ ] GitHub client tests: getRepoContents, getFileContent, rate limit handling
- [ ] Content fetcher tests: fetches .md files, skips non-markdown, handles missing paths
- [ ] Content hash tests: same content → same hash, different content → different hash
- [ ] Indexing orchestrator tests: full pipeline with mocks, skip unchanged, handle errors
- [ ] Document management tests: create, delete, upsert source records

#### Files to Create/Modify

- `src/lib/github/__tests__/client.test.ts` — (create) GitHub client tests
- `src/lib/github/__tests__/fetcher.test.ts` — (create) content fetcher tests
- `src/lib/github/__tests__/indexer.test.ts` — (create) indexing orchestrator tests

#### Implementation Notes

- Mock fetch/GitHub API responses for client tests
- For fetcher tests, mock the GitHubClient to return canned file listings and content
- For indexer tests, mock the fetcher, ingestion pipeline, and Prisma client
- Test the re-indexing scenario: first index creates documents, second index skips unchanged
- Test error scenario: fetch failure → syncStatus set to 'error'

#### Evaluation Checklist

- [ ] `npx vitest run src/lib/github/__tests__/` — all tests pass
