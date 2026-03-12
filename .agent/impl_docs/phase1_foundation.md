# Phase 1: Foundation

## Prerequisites

- Phase 0 complete: Vitest configured, `npm run test` works
- PostgreSQL database accessible via `DATABASE_URL`
- Node.js dependencies installed

## Phase Goal

All foundational infrastructure is complete and tested: database schema is finalized and migrated, error handling framework is robust, LLM provider abstraction is fully functional, and multilingual support is ready for use by higher-level features.

## Phase Evaluation Criteria

- `npx prisma migrate deploy` applies all migrations without errors
- `npx prisma db seed` populates the four EdLight repositories and admin user
- `npx prisma generate` produces a typed client with all 7 models
- `npx vitest run src/lib/utils/` — all error and logging tests pass
- `npx vitest run src/lib/ai/` — all AI provider tests pass
- `npx vitest run src/lib/i18n/` — all multilingual tests pass
- `npx vitest run src/lib/config/` — environment validation tests pass
- `npx tsc --noEmit` passes with no errors
- `npx next lint` passes with no errors
- Importing `src/lib/utils/errors.ts` provides SandraError with 5 subclasses
- Importing `src/lib/ai/provider.ts` returns a configured AIProvider instance

---

## Tasks

### T010: Review and Finalize Prisma Schema

**PRD Reference:** Section 14 (Database)
**Depends on:** Nothing
**Blocks:** T011, T012, T013
**User Stories:** US-01
**Estimated scope:** 1 hour

#### Description

Review the existing Prisma schema at `prisma/schema.prisma` against the PRD and feature requirements. Ensure all 7 V1 models are complete with correct fields, types, relations, and indexes. Add any missing fields identified during analysis (e.g., ensure Message has `toolName` and `toolCallId` for tool call tracking, IndexedDocument has `embedding` as a float array, RepoRegistry has `syncStatus`).

#### Acceptance Criteria

- [ ] All 7 models defined: User, Session, Message, Memory, IndexedSource, IndexedDocument, RepoRegistry
- [ ] Session model has: id, userId (optional), channel, language, title, metadata (Json), isActive, createdAt, updatedAt
- [ ] Message model has: id, sessionId, role (enum: user/assistant/system/tool), content, language, toolName, toolCallId, metadata (Json), createdAt
- [ ] IndexedDocument model has: embedding (Float[]) for vector storage
- [ ] RepoRegistry model has: syncStatus enum (not_indexed, indexing, indexed, error)
- [ ] Appropriate indexes on: Session(userId, isActive), Message(sessionId), IndexedDocument(sourceId, contentHash), RepoRegistry(owner, name)

#### Files to Create/Modify

- `prisma/schema.prisma` — (modify) review and complete all models, relations, indexes

#### Implementation Notes

- The schema already exists with 7 models — this task is about review and completion, not creation from scratch
- Check that `MessageRole` enum covers: `user`, `assistant`, `system`, `tool`
- Check that `SyncStatus` enum covers: `not_indexed`, `indexing`, `indexed`, `error`
- Ensure `IndexedDocument.embedding` is typed as `Float[]` for in-memory vector operations
- Add `@@index` annotations for query performance on commonly-filtered fields
- Do NOT add V2 tables (roles, permissions, audit_logs) — keep scope to V1

#### Evaluation Checklist

- [ ] `npx prisma validate` passes
- [ ] All 7 models have complete field definitions

---

### T011: Create and Apply Database Migration

**PRD Reference:** Section 14 (Database)
**Depends on:** T010
**Blocks:** T012, T013, T014
**User Stories:** US-01
**Estimated scope:** 30 min

#### Description

Generate a Prisma migration from the finalized schema and apply it to the development database. Verify that the migration creates all tables and indexes.

#### Acceptance Criteria

- [ ] Migration file generated in `prisma/migrations/`
- [ ] `npx prisma migrate deploy` applies successfully
- [ ] All 7 tables exist in the database
- [ ] `npx prisma generate` produces typed client

#### Files to Create/Modify

- `prisma/migrations/` — (create) new migration directory with SQL
- `src/lib/db/client.ts` — (modify) verify Prisma client singleton pattern works with generated types

#### Implementation Notes

- Run `npx prisma migrate dev --name v1_foundation` to create the migration
- If existing migrations conflict, use `npx prisma migrate reset` in development
- Verify the generated client by importing and checking model types in a quick script
- The singleton pattern in `src/lib/db/client.ts` should already work — just verify it

#### Evaluation Checklist

- [ ] `npx prisma migrate deploy` exits with code 0
- [ ] `npx prisma generate` exits with code 0

---

### T012: Verify and Enhance Seed Data

**PRD Reference:** Section 7 (EdLight Ecosystem Integration)
**Depends on:** T011
**Blocks:** Nothing
**User Stories:** US-01
**Estimated scope:** 30 min

#### Description

Review the existing seed script at `prisma/seed.ts`. Ensure it creates the four EdLight repositories in RepoRegistry with correct GitHub URLs, branches, and docs paths. Verify the admin user seed. Make the script idempotent (safe to run multiple times).

#### Acceptance Criteria

- [ ] Seed creates 4 repos: edlinitiative/code, edlinitiative/EdLight-News, edlinitiative/EdLight-Initiative, edlinitiative/EdLight-Academy
- [ ] Each repo has correct: owner, name, displayName, description, url, branch (main), docsPath, isActive
- [ ] Seed creates a default admin user
- [ ] Running `npx prisma db seed` twice does not create duplicates (upsert pattern)
- [ ] Seed completes without errors

#### Files to Create/Modify

- `prisma/seed.ts` — (modify) ensure idempotency and completeness

#### Implementation Notes

- Use `prisma.repoRegistry.upsert()` keyed on `{ owner, name }` compound unique
- If no compound unique exists in schema, add `@@unique([owner, name])` to RepoRegistry in T010
- Verify docsPath values: "docs/" for code and EdLight-Academy, root for News and Initiative
- Admin user should use upsert on email

#### Evaluation Checklist

- [ ] `npx prisma db seed` completes without errors
- [ ] Running it again produces no duplicates

---

### T013: Create Typed Data Access Helpers

**PRD Reference:** Section 14 (Database)
**Depends on:** T011
**Blocks:** T030, T031
**User Stories:** US-01
**Estimated scope:** 1 hour

#### Description

Create a data access layer with typed helper functions that wrap common Prisma queries. These helpers centralize query logic and provide a stable API for services to use.

#### Acceptance Criteria

- [ ] `src/lib/db/sessions.ts` exports: `createSession`, `getSessionById`, `getSessionMessages`, `updateSession`
- [ ] `src/lib/db/messages.ts` exports: `createMessage`, `getMessagesBySessionId`
- [ ] `src/lib/db/repos.ts` exports: `getActiveRepos`, `getRepoByOwnerAndName`, `updateRepoSyncStatus`
- [ ] `src/lib/db/documents.ts` exports: `createIndexedDocument`, `getDocumentsBySourceId`, `getDocumentByHash`
- [ ] All helpers are fully typed with Prisma-generated types

#### Files to Create/Modify

- `src/lib/db/sessions.ts` — (create) session query helpers
- `src/lib/db/messages.ts` — (create) message query helpers
- `src/lib/db/repos.ts` — (create) repository query helpers
- `src/lib/db/documents.ts` — (create) indexed document query helpers
- `src/lib/db/index.ts` — (modify) re-export all helpers

#### Implementation Notes

- Each helper takes the Prisma client as the first argument (dependency injection for testability)
- `getSessionMessages` should accept `limit` and `orderBy` params for context loading
- `updateRepoSyncStatus` should accept a status from the SyncStatus enum
- Use Prisma's `select` or `include` judiciously — default to returning full objects
- Keep these thin — they should be simple wrappers, not business logic

#### Evaluation Checklist

- [ ] All helper files export typed functions
- [ ] `npx tsc --noEmit` passes with the new files

---

### T014: Database Layer Unit Tests

**PRD Reference:** N/A (quality)
**Depends on:** T013, T002
**Blocks:** Nothing
**User Stories:** US-01
**Estimated scope:** 1 hour

#### Description

Write unit tests for the data access helpers using the mock Prisma client from T002. Test that helpers call the correct Prisma methods with the right arguments.

#### Acceptance Criteria

- [ ] Tests for session helpers: create, get by ID, get messages, update
- [ ] Tests for message helpers: create, get by session ID
- [ ] Tests for repo helpers: get active repos, get by owner/name, update sync status
- [ ] All tests pass with mock Prisma client

#### Files to Create/Modify

- `src/lib/db/__tests__/sessions.test.ts` — (create) session helper tests
- `src/lib/db/__tests__/messages.test.ts` — (create) message helper tests
- `src/lib/db/__tests__/repos.test.ts` — (create) repo helper tests

#### Implementation Notes

- Use the mock Prisma client from `src/lib/__tests__/mocks/prisma.ts`
- Test that each helper calls the right model method (e.g., `prisma.session.create`)
- Test that arguments are passed correctly (e.g., `where`, `data`, `include`)
- Test edge cases: not found returns null, empty results return empty arrays

#### Evaluation Checklist

- [ ] `npx vitest run src/lib/db/__tests__/` — all tests pass
- [ ] Each helper has at least one test

---

### T015: Complete SandraError Subclasses

**PRD Reference:** Section 15 (Security and Privacy)
**Depends on:** Nothing
**Blocks:** T016, T019
**User Stories:** US-02
**Estimated scope:** 45 min

#### Description

Review and complete the error handling framework in `src/lib/utils/errors.ts`. Ensure SandraError base class exists with 5 subclasses, each with a machine-readable error code and HTTP status mapping.

#### Acceptance Criteria

- [ ] `SandraError` base class with: message, code (string), statusCode (number), details (optional)
- [ ] `ValidationError` (code: `VALIDATION_ERROR`, status: 400)
- [ ] `AuthError` (code: `AUTH_ERROR`, status: 401)
- [ ] `NotFoundError` (code: `NOT_FOUND`, status: 404)
- [ ] `ProviderError` (code: `PROVIDER_ERROR`, status: 502)
- [ ] `ToolError` (code: `TOOL_ERROR`, status: 500)
- [ ] Each error serializes to `{ error: { code, message, details } }` via a `toJSON()` method

#### Files to Create/Modify

- `src/lib/utils/errors.ts` — (modify) complete error subclasses and serialization

#### Implementation Notes

- The file already exists with some error classes — review and complete
- Add `toJSON()` to base class: returns `{ error: { code: this.code, message: this.message, details: this.details } }`
- Ensure all subclasses call `super()` with correct code and status
- Export all classes individually and as a namespace

#### Evaluation Checklist

- [ ] Importing the module provides all 5 error subclasses
- [ ] `new ValidationError('bad input').toJSON()` returns the expected shape
- [ ] `npx tsc --noEmit` passes

---

### T016: Environment Secrets Validation

**PRD Reference:** Section 15 (Security and Privacy)
**Depends on:** T015
**Blocks:** T019
**User Stories:** US-02
**Estimated scope:** 30 min

#### Description

Review and complete the Zod-based environment validation at `src/lib/config/env.ts`. Ensure all required V1 environment variables are validated at startup with clear error messages for missing values.

#### Acceptance Criteria

- [ ] Zod schema validates: DATABASE_URL (required), OPENAI_API_KEY (required), OPENAI_MODEL (default: gpt-4o), GITHUB_TOKEN (optional), ADMIN_API_KEY (optional, for admin endpoints), NODE_ENV (default: development)
- [ ] Missing required variables cause a clear error listing all missing keys
- [ ] The validated config object is exported as a typed singleton
- [ ] Validation runs at module import time (startup)

#### Files to Create/Modify

- `src/lib/config/env.ts` — (modify) complete Zod schema and validation
- `src/lib/config/constants.ts` — (modify) ensure app-wide constants are defined (max iterations, context window size, chunk size)

#### Implementation Notes

- The env.ts file already exists with Zod validation — review and add any missing variables
- Use `z.string().min(1)` for required strings to catch empty values
- Add `ADMIN_API_KEY` as optional (needed by F11 admin endpoints)
- In constants.ts, define: `MAX_AGENT_ITERATIONS = 5`, `CONTEXT_WINDOW_MESSAGES = 20`, `CHUNK_SIZE = 1000`, `CHUNK_OVERLAP = 200`, `TOP_K_RESULTS = 5`
- Export the parsed env object (not the schema) for consumers

#### Evaluation Checklist

- [ ] Missing `DATABASE_URL` throws a clear error at import time
- [ ] The exported config object has correct TypeScript types

---

### T017: Structured Logging Utility

**PRD Reference:** Section 15 (Security and Privacy)
**Depends on:** Nothing
**Blocks:** T019
**User Stories:** US-02
**Estimated scope:** 30 min

#### Description

Review and complete the structured logging utility at `src/lib/utils/logger.ts`. Ensure it outputs JSON logs with timestamp, level, message, and optional context fields including requestId.

#### Acceptance Criteria

- [ ] Logger exports methods: `info`, `warn`, `error`, `debug`
- [ ] Each log entry is a JSON object with: `timestamp`, `level`, `message`, and spread context fields
- [ ] A `withRequestId(requestId)` method returns a child logger that includes `requestId` in all entries
- [ ] Debug logs are suppressed in production (`NODE_ENV === 'production'`)

#### Files to Create/Modify

- `src/lib/utils/logger.ts` — (modify) complete structured logging implementation

#### Implementation Notes

- The file already exists — review and complete
- Use `console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...context }))` pattern
- `withRequestId` returns a new object with the same methods but `requestId` pre-bound in context
- Check `process.env.NODE_ENV` for debug suppression
- Keep it simple — no external logging library needed for V1

#### Evaluation Checklist

- [ ] `logger.info('test', { requestId: '123' })` outputs valid JSON
- [ ] `logger.withRequestId('123').info('test')` includes requestId

---

### T018: Input Sanitization and Validation Helpers

**PRD Reference:** Section 15 (Security and Privacy)
**Depends on:** T015
**Blocks:** T019
**User Stories:** US-02
**Estimated scope:** 30 min

#### Description

Review and complete input sanitization helpers in `src/lib/utils/validation.ts`. Create reusable Zod schemas for common API input patterns.

#### Acceptance Criteria

- [ ] `sanitizeInput(str)` strips HTML tags and trims whitespace
- [ ] `chatInputSchema` validates: message (string, 1-4000 chars), sessionId (optional uuid), language (optional enum: en/fr/ht)
- [ ] `indexInputSchema` validates: repoId (string, required)
- [ ] `sessionIdSchema` validates a UUID string
- [ ] Zod schemas produce user-friendly error messages

#### Files to Create/Modify

- `src/lib/utils/validation.ts` — (modify) complete sanitization and Zod schemas

#### Implementation Notes

- The file may already exist with some utilities — review and complete
- `sanitizeInput`: use a simple regex to strip `<[^>]*>` tags, then `.trim()`
- For Zod schemas, use `.describe()` for field documentation
- `chatInputSchema` is the most important — it's used by POST /api/chat
- Use `z.enum(['en', 'fr', 'ht'])` for language validation
- Export all schemas for use in API routes

#### Evaluation Checklist

- [ ] `sanitizeInput('<script>alert("xss")</script>hello')` returns `'alert("xss")hello'`
- [ ] `chatInputSchema.parse({ message: 'hi' })` succeeds
- [ ] `chatInputSchema.parse({ message: '' })` throws validation error

---

### T019: Security and Error Handling Tests

**PRD Reference:** N/A (quality)
**Depends on:** T015, T016, T017, T018, T002
**Blocks:** Nothing
**User Stories:** US-02
**Estimated scope:** 1 hour

#### Description

Write unit tests for all error handling, validation, and logging utilities.

#### Acceptance Criteria

- [ ] Error class tests: each subclass has correct code, statusCode, and toJSON output
- [ ] Environment validation tests: missing required vars throw, defaults work
- [ ] Logger tests: output includes correct fields, withRequestId works
- [ ] Sanitization tests: XSS stripping, Zod schema validation/rejection

#### Files to Create/Modify

- `src/lib/utils/__tests__/errors.test.ts` — (create) error class tests
- `src/lib/config/__tests__/env.test.ts` — (create) env validation tests
- `src/lib/utils/__tests__/logger.test.ts` — (create) logger tests
- `src/lib/utils/__tests__/validation.test.ts` — (create) validation tests

#### Implementation Notes

- For env tests, mock `process.env` using `vi.stubEnv()` or manual override
- For logger tests, spy on `console.log` with `vi.spyOn(console, 'log')` and parse the JSON output
- Test error hierarchy: `new ValidationError('x') instanceof SandraError` should be true
- Test that all Zod schemas reject invalid input with meaningful messages

#### Evaluation Checklist

- [ ] `npx vitest run src/lib/utils/__tests__/` — all tests pass
- [ ] `npx vitest run src/lib/config/__tests__/` — all tests pass

---

### T020: Finalize AIProvider Interface Types

**PRD Reference:** Section 14 (AI Model)
**Depends on:** Nothing
**Blocks:** T021, T022, T023, T024
**User Stories:** US-03
**Estimated scope:** 30 min

#### Description

Review and finalize the AIProvider interface in `src/lib/ai/types.ts`. Ensure it defines all methods needed by the agent runtime: chat completion with tool support, streaming, and embedding generation.

#### Acceptance Criteria

- [ ] `AIProvider` interface defines: `chatCompletion(params): Promise<ChatCompletionResult>`
- [ ] `AIProvider` interface defines: `streamChatCompletion(params): AsyncIterable<StreamChunk>`
- [ ] `AIProvider` interface defines: `generateEmbedding(text): Promise<number[]>`
- [ ] `ChatCompletionParams` includes: messages, tools (optional), temperature (optional)
- [ ] `ChatCompletionResult` includes: content (string | null), toolCalls (ToolCall[]), usage (TokenUsage)
- [ ] `ToolCall` type includes: id, name, arguments (string — JSON)
- [ ] `StreamChunk` type includes: content (string | null), toolCalls (ToolCall[] | null), done (boolean)

#### Files to Create/Modify

- `src/lib/ai/types.ts` — (modify) finalize all types and interfaces

#### Implementation Notes

- The file already exists — review against the requirements above
- Ensure `ChatMessage` type supports roles: system, user, assistant, tool
- Tool messages need `toolCallId` for mapping results back to calls
- `TokenUsage` should have: promptTokens, completionTokens, totalTokens
- Keep types generic — no OpenAI-specific types in this file

#### Evaluation Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] All types are exported and documented with JSDoc

---

### T021: Complete OpenAI Chat Completion Implementation

**PRD Reference:** Section 14 (AI Model)
**Depends on:** T020
**Blocks:** T025
**User Stories:** US-03
**Estimated scope:** 1 hour

#### Description

Review and complete the OpenAI implementation of `chatCompletion` in `src/lib/ai/openai.ts`. Ensure it correctly maps between the AIProvider types and the OpenAI SDK, including tool calling support.

#### Acceptance Criteria

- [ ] `chatCompletion` sends messages to OpenAI and returns `ChatCompletionResult`
- [ ] Tool definitions are converted to OpenAI function format when provided
- [ ] Tool calls in the response are extracted and returned as `ToolCall[]`
- [ ] Token usage is extracted and returned
- [ ] OpenAI errors are caught and wrapped in `ProviderError`

#### Files to Create/Modify

- `src/lib/ai/openai.ts` — (modify) complete chatCompletion method

#### Implementation Notes

- The file already exists with an OpenAI implementation — review completeness
- Map `AIProvider` tool format to OpenAI's `tools: [{ type: 'function', function: { name, description, parameters } }]`
- Map OpenAI response `choices[0].message.tool_calls` back to `ToolCall[]`
- Wrap all OpenAI SDK errors in `ProviderError` from `src/lib/utils/errors.ts`
- Use the model from env config (`OPENAI_MODEL`, default `gpt-4o`)

#### Evaluation Checklist

- [ ] Method signature matches `AIProvider.chatCompletion`
- [ ] `npx tsc --noEmit` passes

---

### T022: Complete OpenAI Streaming Implementation

**PRD Reference:** Section 14 (AI Model)
**Depends on:** T020
**Blocks:** T025
**User Stories:** US-03
**Estimated scope:** 1 hour

#### Description

Review and complete the streaming chat completion method in the OpenAI provider. This powers the SSE streaming endpoint.

#### Acceptance Criteria

- [ ] `streamChatCompletion` returns an `AsyncIterable<StreamChunk>`
- [ ] Each chunk contains incremental content or tool call deltas
- [ ] The final chunk has `done: true`
- [ ] Tool call arguments are accumulated across chunks and yielded as complete calls
- [ ] Errors during streaming are caught and yield an error chunk

#### Files to Create/Modify

- `src/lib/ai/openai.ts` — (modify) complete streamChatCompletion method

#### Implementation Notes

- Use OpenAI SDK's `client.chat.completions.create({ stream: true })` which returns an async iterable
- Tool calls arrive as deltas — accumulate `arguments` string across chunks for each tool call index
- Yield a `StreamChunk` for each content delta
- When the stream ends, yield `{ content: null, toolCalls: accumulatedToolCalls, done: true }`
- Use `async function*` generator pattern for clean async iteration

#### Evaluation Checklist

- [ ] Method signature matches `AIProvider.streamChatCompletion`
- [ ] `npx tsc --noEmit` passes

---

### T023: Complete Embedding Generation

**PRD Reference:** Section 14 (AI Model), Section 12 (Knowledge Layer)
**Depends on:** T020
**Blocks:** T025
**User Stories:** US-03
**Estimated scope:** 30 min

#### Description

Review and complete the embedding generation method in the OpenAI provider. Uses `text-embedding-3-small` model.

#### Acceptance Criteria

- [ ] `generateEmbedding(text)` returns `Promise<number[]>`
- [ ] Uses the `text-embedding-3-small` model
- [ ] Returns a float array (the embedding vector)
- [ ] Errors are wrapped in `ProviderError`

#### Files to Create/Modify

- `src/lib/ai/openai.ts` — (modify) complete generateEmbedding method

#### Implementation Notes

- Use `client.embeddings.create({ model: 'text-embedding-3-small', input: text })`
- Return `response.data[0].embedding`
- The embedding dimension for text-embedding-3-small is 1536
- Wrap errors in `ProviderError` with the original error as details

#### Evaluation Checklist

- [ ] Method signature matches `AIProvider.generateEmbedding`
- [ ] `npx tsc --noEmit` passes

---

### T024: Provider Factory with Environment Config

**PRD Reference:** Section 14 (AI Model)
**Depends on:** T020, T021, T016
**Blocks:** T025
**User Stories:** US-03
**Estimated scope:** 30 min

#### Description

Review and complete the provider factory in `src/lib/ai/provider.ts` that instantiates the correct AIProvider based on environment configuration.

#### Acceptance Criteria

- [ ] `getAIProvider()` returns a singleton AIProvider instance
- [ ] The provider reads API key and model from the validated env config
- [ ] Missing API key returns a provider that throws `ProviderError` on all calls (graceful degradation)
- [ ] The factory is the only way to obtain an AIProvider — no direct instantiation outside this module

#### Files to Create/Modify

- `src/lib/ai/provider.ts` — (modify) complete factory function
- `src/lib/ai/index.ts` — (modify) ensure proper exports

#### Implementation Notes

- The file likely already exports a factory — review and ensure singleton pattern
- Use the validated `env.OPENAI_API_KEY` from `src/lib/config/env.ts`
- For missing API key, consider a "demo" or "null" provider that returns canned responses (supports dev without API key)
- Cache the provider instance in module scope: `let _provider: AIProvider | null = null`

#### Evaluation Checklist

- [ ] `getAIProvider()` returns a valid AIProvider
- [ ] Calling `getAIProvider()` twice returns the same instance

---

### T025: AI Provider Unit Tests

**PRD Reference:** N/A (quality)
**Depends on:** T021, T022, T023, T024, T002
**Blocks:** Nothing
**User Stories:** US-03
**Estimated scope:** 1 hour

#### Description

Write unit tests for the AI provider layer: type correctness, factory behavior, and mock-based provider tests.

#### Acceptance Criteria

- [ ] Factory test: returns provider when API key is set
- [ ] Factory test: returns demo/null provider when API key is missing
- [ ] Type test: ChatCompletionResult has all required fields
- [ ] Mock provider tests: chatCompletion returns expected shape, generateEmbedding returns float array

#### Files to Create/Modify

- `src/lib/ai/__tests__/provider.test.ts` — (create) factory tests
- `src/lib/ai/__tests__/types.test.ts` — (create) type validation tests

#### Implementation Notes

- Use the mock AIProvider from `src/lib/__tests__/mocks/ai-provider.ts`
- For factory tests, mock the env config using `vi.mock('src/lib/config/env')`
- Don't make real OpenAI API calls — test the mapping logic with mocked SDK responses
- Test that ProviderError is thrown for error scenarios

#### Evaluation Checklist

- [ ] `npx vitest run src/lib/ai/__tests__/` — all tests pass

---

### T026: Language Enum and Type Definitions

**PRD Reference:** Section 11 (Multilingual Support)
**Depends on:** Nothing
**Blocks:** T027, T028, T029
**User Stories:** US-04
**Estimated scope:** 30 min

#### Description

Review and finalize language types in `src/lib/i18n/types.ts` and `src/lib/i18n/languages.ts`. Ensure the three supported languages are defined with proper enums and metadata.

#### Acceptance Criteria

- [ ] `Language` enum or union type: `'en' | 'fr' | 'ht'`
- [ ] `LanguageConfig` map with: name, nativeName, direction ('ltr'), greeting text
- [ ] `DEFAULT_LANGUAGE` constant set to `'en'`
- [ ] `isValidLanguage(str)` type guard function
- [ ] All types are exported from `src/lib/i18n/index.ts`

#### Files to Create/Modify

- `src/lib/i18n/types.ts` — (modify) finalize language types
- `src/lib/i18n/languages.ts` — (modify) finalize language config map

#### Implementation Notes

- The files already exist — review for completeness
- `LanguageConfig` should include greeting text for empty state suggested questions
- English: "Hello! I'm Sandra...", French: "Bonjour ! Je suis Sandra...", Haitian Creole: "Bonjou! Mwen se Sandra..."
- Keep nativeName: English → "English", French → "Français", Haitian Creole → "Kreyòl Ayisyen"

#### Evaluation Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] `isValidLanguage('ht')` returns true, `isValidLanguage('de')` returns false

---

### T027: Language Detection and Selection Utility

**PRD Reference:** Section 11 (Multilingual Support)
**Depends on:** T026
**Blocks:** T029
**User Stories:** US-04
**Estimated scope:** 30 min

#### Description

Implement a utility that determines the language for a given request based on: explicit parameter > session preference > default.

#### Acceptance Criteria

- [ ] `resolveLanguage(params: { explicit?: string, sessionLanguage?: string })` returns a valid `Language`
- [ ] Priority: explicit parameter > session preference > DEFAULT_LANGUAGE
- [ ] Invalid language values fall back to DEFAULT_LANGUAGE
- [ ] Function is pure (no side effects)

#### Files to Create/Modify

- `src/lib/i18n/languages.ts` — (modify) add `resolveLanguage` function

#### Implementation Notes

- Simple cascading logic: check explicit first, then session, then default
- Use `isValidLanguage` type guard from T026 for validation
- This is used in API routes to determine response language per-request
- Keep it simple — no Accept-Language header parsing for V1

#### Evaluation Checklist

- [ ] `resolveLanguage({ explicit: 'fr' })` returns `'fr'`
- [ ] `resolveLanguage({ explicit: 'invalid' })` returns `'en'`
- [ ] `resolveLanguage({})` returns `'en'`

---

### T028: System Prompt Helpers for Multilingual Behavior

**PRD Reference:** Section 11 (Multilingual Support), Section 13 (Agent System)
**Depends on:** T026
**Blocks:** T029
**User Stories:** US-04
**Estimated scope:** 45 min

#### Description

Create system prompt helper functions that generate language-specific instructions for the LLM. These are injected into the system prompt to control Sandra's response language.

#### Acceptance Criteria

- [ ] `getLanguageInstruction(lang: Language)` returns a system prompt snippet (e.g., "You MUST respond in French.")
- [ ] `getSandraSystemPrompt(params: { language: Language, tools: ToolDefinition[] })` returns the full system prompt
- [ ] System prompt includes: Sandra persona, language instruction, available tool descriptions, behavioral guidelines
- [ ] Each language has a tested prompt snippet

#### Files to Create/Modify

- `src/lib/i18n/index.ts` — (modify) add system prompt helpers
- `src/lib/agents/prompts.ts` — (modify) integrate language instructions into the agent system prompt

#### Implementation Notes

- `getLanguageInstruction` returns strings like:
  - `en`: "Respond in English."
  - `fr`: "You MUST respond in French (Français). All output must be in French."
  - `ht`: "You MUST respond in Haitian Creole (Kreyòl Ayisyen). All output must be in Haitian Creole."
- `getSandraSystemPrompt` combines: persona description + language instruction + tool descriptions + guidelines
- The agent prompt in `src/lib/agents/prompts.ts` likely already exists — wire in the language instruction
- Tool descriptions should list available tool names and what they do, formatted for the LLM

#### Evaluation Checklist

- [ ] `getLanguageInstruction('ht')` contains "Haitian Creole"
- [ ] `getSandraSystemPrompt({ language: 'fr', tools: [] })` returns a non-empty string containing "French"

---

### T029: Multilingual Support Unit Tests

**PRD Reference:** N/A (quality)
**Depends on:** T026, T027, T028, T002
**Blocks:** Nothing
**User Stories:** US-04
**Estimated scope:** 30 min

#### Description

Write unit tests for all i18n utilities: language types, detection, and prompt generation.

#### Acceptance Criteria

- [ ] Language validation tests: valid and invalid codes
- [ ] Language resolution tests: all priority cases
- [ ] System prompt tests: language instruction included, tool descriptions included

#### Files to Create/Modify

- `src/lib/i18n/__tests__/languages.test.ts` — (create) language utility tests
- `src/lib/i18n/__tests__/prompts.test.ts` — (create) prompt helper tests

#### Implementation Notes

- Test all three languages for each utility
- Verify system prompt contains the correct language instruction
- Verify system prompt includes tool names when tools are provided
- Test edge cases: empty tool list, undefined language

#### Evaluation Checklist

- [ ] `npx vitest run src/lib/i18n/__tests__/` — all tests pass
