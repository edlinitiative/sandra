# Phase 4: Interface Layer

> Historical phase note: this phase doc was written before the current V2 contract
> freeze. Use `docs/releases/v2_signoff.md` for the current release-checklist
> version of the admin, chat, streaming, and health contracts.

## Prerequisites

- Phase 3 complete: all agent and indexing tests pass
- `npx vitest run src/lib/agents/ src/lib/github/` — all pass
- `runSandraAgent(input)` returns a response for a given InboundMessage
- `runSandraAgentStream(input)` yields token events
- `indexRepository(repoId)` processes a repository through the RAG pipeline
- Session management, tool registry, and RAG pipeline all functional

## Infrastructure Updates Required

### IU-3: Export Agent Entry Points

**File:** `src/lib/agents/index.ts`

Ensure `runSandraAgent` and `runSandraAgentStream` are exported from the agents module index for API route consumption.

```typescript
export { runSandraAgent, runSandraAgentStream } from './sandra';
export type { AgentStreamEvent, InboundMessage, OutboundMessage } from './types';
```

**Tests:** Import from `src/lib/agents` in a test and verify exports exist.

### IU-4: Export Indexing Entry Point

**File:** `src/lib/github/index.ts`

Ensure `indexRepository` and related types are exported.

```typescript
export { indexRepository } from './indexer';
export type { IndexingResult } from './types';
```

**Tests:** Import from `src/lib/github` in a test and verify exports exist.

## Phase Goal

All API endpoints are implemented and validated, the web chat UI is complete with streaming and responsive layout, and admin indexing controls are functional with API key authentication.

## Phase Evaluation Criteria

- `npx vitest run src/app/api/` — all API route tests pass
- `npx vitest run src/components/` — all UI component tests pass (if React Testing Library added)
- `curl -X POST http://localhost:3000/api/chat -H 'Content-Type: application/json' -d '{"message":"Hello"}'` returns `{ success: true, data: { response: "...", sessionId: "..." } }`
- `curl http://localhost:3000/api/health` returns `{ status: "ok" }`
- `curl http://localhost:3000/api/repos -H 'x-api-key: ...'` returns repo list
- `curl -X POST http://localhost:3000/api/index -H 'x-api-key: ...' -H 'Content-Type: application/json' -d '{"repoId":"..."}'` triggers indexing
- Web chat UI renders at `http://localhost:3000` — message input, send button, message list visible
- Streaming responses render word-by-word in the chat
- Chat works on a 320px-wide viewport (mobile)
- `npx tsc --noEmit` passes with no errors
- `npx next lint` passes with no errors
- `npm run build` completes without errors

---

## Tasks

### T090: Request ID Middleware and JSON Envelope Helper

**PRD Reference:** Section 14 (Backend Server)
**Depends on:** T017 (structured logging)
**Blocks:** T091, T092, T093, T094, T096
**User Stories:** US-14
**Estimated scope:** 45 min

#### Description

Create reusable utilities for API routes: request ID generation, standard JSON response envelope, and error response formatting.

#### Acceptance Criteria

- [ ] `generateRequestId()` returns a UUID for request tracing
- [ ] `successResponse(data, meta?)` returns `{ success: true, data, meta: { requestId } }`
- [ ] `errorResponse(error: SandraError, requestId)` returns `{ success: false, error: { code, message }, meta: { requestId } }`
- [ ] `withRequestId(handler)` wraps a route handler to inject requestId into context and logger

#### Files to Create/Modify

- `src/lib/utils/api-helpers.ts` — (create) API utility functions
- `src/lib/utils/index.ts` — (modify) re-export api-helpers

#### Implementation Notes

- `successResponse` adds `meta.requestId` automatically (generate if not provided)
- `errorResponse` maps SandraError to the standard error envelope
- `withRequestId` is a higher-order function that generates a requestId, creates a child logger, and passes both to the handler
- Use `crypto.randomUUID()` for request IDs (Node.js built-in)
- These utilities keep API route files focused on business logic

#### Evaluation Checklist

- [ ] `successResponse({ foo: 'bar' })` returns correct envelope shape
- [ ] `errorResponse(new NotFoundError('x'), 'req-123')` returns 404 shape

---

### T091: POST /api/chat Endpoint

**PRD Reference:** Section 14 (Backend Server)
**Depends on:** T090, T063 (agent runtime), T018 (validation schemas)
**Blocks:** T096
**User Stories:** US-14
**Estimated scope:** 1 hour

#### Description

Complete the main chat endpoint that accepts user messages and returns agent responses.

#### Acceptance Criteria

- [ ] Accepts POST with body: `{ message: string, sessionId?: string, language?: 'en'|'fr'|'ht' }`
- [ ] Validates input with `chatInputSchema` from T018
- [ ] Sanitizes message content with `sanitizeInput()`
- [ ] Calls `runSandraAgent()` with an InboundMessage
- [ ] Returns: `{ success: true, data: { response: string, sessionId: string }, meta: { requestId: string } }`
- [ ] Invalid input returns 400 with validation error details
- [ ] Agent errors return 500 with user-friendly error message
- [ ] All chat-related routes (POST /api/chat, POST /api/chat/stream, GET /api/conversations/[sessionId]) validate input with the appropriate Zod schema (chatInputSchema, sessionIdSchema)
- [ ] All validation errors across routes return 400 with `{ success: false, error: { code: 'VALIDATION_ERROR', message: '...', details: [...] } }`

#### Files to Create/Modify

- `src/app/api/chat/route.ts` — (modify) complete POST handler
- `src/app/api/chat/stream/route.ts` — (verify) Zod validation in place
- `src/app/api/conversations/[sessionId]/route.ts` — (verify) Zod validation in place

#### Implementation Notes

- File already exists with some implementation — review and complete
- Build `InboundMessage` from validated body: `{ content: sanitized message, sessionId, language, channel: 'web' }`
- Use `withRequestId` wrapper for request tracing
- Catch and handle errors: ValidationError → 400, ProviderError → 502, others → 500
- Log: request received, agent called, response sent (with requestId and duration)
- Wrap Zod parse in try-catch: `catch (e) { if (e instanceof ZodError) return errorResponse(new ValidationError(e.message), requestId) }`
- Use Zod's `flatten()` method for structured field errors in the `details` field
- Verify all POST endpoints reject empty or malformed bodies with 400

#### Evaluation Checklist

- [ ] `curl -X POST /api/chat -d '{"message":"hi"}' -H 'Content-Type: application/json'` returns success
- [ ] `curl -X POST /api/chat -d '{}'` returns 400 validation error
- [ ] All POST endpoints reject empty or malformed bodies with 400
- [ ] Error responses follow the standard envelope format

---

### T092: SSE Streaming Endpoint

**PRD Reference:** Section 14 (Backend Server)
**Depends on:** T090, T066 (agent streaming)
**Blocks:** T096
**User Stories:** US-14
**Estimated scope:** 1 hour

#### Description

Complete the SSE streaming endpoint that delivers token-by-token responses to the client.

#### Acceptance Criteria

- [ ] Accepts POST with same body as /api/chat
- [ ] Returns SSE stream (`Content-Type: text/event-stream`)
- [ ] Events: `data: {"type":"token","data":"word"}`, `data: {"type":"done","data":"sessionId"}`
- [ ] Tool call events: `data: {"type":"tool_call","data":"toolName"}`
- [ ] Error events: `data: {"type":"error","data":"message"}`
- [ ] Stream closes after done or error event

#### Files to Create/Modify

- `src/app/api/chat/stream/route.ts` — (modify) complete streaming POST handler

#### Implementation Notes

- File already exists — review and complete
- Use `ReadableStream` and `new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })`
- Iterate over `runSandraAgentStream(input)` and write each event as SSE format: `data: ${JSON.stringify(event)}\n\n`
- Set headers: `Cache-Control: no-cache`, `Connection: keep-alive`
- Handle client disconnect: check if the stream controller is still open before writing

#### Evaluation Checklist

- [ ] Streaming endpoint returns `Content-Type: text/event-stream`
- [ ] Events are valid SSE format

---

### T093: GET /api/conversations/[sessionId] Endpoint

**PRD Reference:** Section 14 (Backend Server)
**Depends on:** T090, T030 (session management)
**Blocks:** T096
**User Stories:** US-14
**Estimated scope:** 30 min

#### Description

Implement the conversation history endpoint that returns all messages for a session.

#### Acceptance Criteria

- [ ] GET /api/conversations/[sessionId] returns message history
- [ ] Response: `{ success: true, data: { sessionId, messages: [{ role, content, createdAt }] }, meta: { requestId } }`
- [ ] Messages ordered chronologically
- [ ] Invalid sessionId returns 400
- [ ] Session not found returns 404

#### Files to Create/Modify

- `src/app/api/conversations/[sessionId]/route.ts` — (modify) complete GET handler

#### Implementation Notes

- File already exists as a stub — complete the implementation
- Use `getSession()` to verify session exists, then `getMessages()` to load history
- Validate sessionId as UUID using `sessionIdSchema`
- Strip internal fields (metadata, toolCallId) from response — return only user-visible data
- This endpoint is used by the web chat to restore conversation on page reload

#### Evaluation Checklist

- [ ] Valid sessionId returns message history
- [ ] Non-existent sessionId returns 404

---

### T094: GET /api/health Endpoint

**PRD Reference:** Section 14 (Backend Server)
**Depends on:** T090
**Blocks:** T096
**User Stories:** US-15
**Estimated scope:** 30 min

#### Description

Complete the health check endpoint that verifies Sandra's dependencies are accessible.

#### Acceptance Criteria

- [ ] Returns `{ status: "ok", timestamp: "...", checks: { database: "ok", vectorStore: "ok" } }` when healthy
- [ ] Database check: attempt a simple Prisma query (e.g., `prisma.$queryRaw`)
- [ ] Vector store check: verify store is initialized (`vectorStore.size()` doesn't throw)
- [ ] If any check fails: return `{ status: "degraded", checks: { database: "ok", vectorStore: "error: ..." } }` with HTTP 503
- [ ] Responds within 5 seconds (timeout long-running checks)

#### Files to Create/Modify

- `src/app/api/health/route.ts` — (modify) complete health check with dependency verification

#### Implementation Notes

- File already exists — review and complete
- Database check: `await prisma.$queryRaw\`SELECT 1\`` wrapped in try-catch
- Vector store check: `getVectorStore().size()` wrapped in try-catch
- Use `Promise.race` with a 5-second timeout for each check
- Return 200 for "ok", 503 for "degraded"
- Include timestamp: `new Date().toISOString()`

#### Evaluation Checklist

- [ ] `curl /api/health` returns status "ok" or "degraded"
- [ ] Response includes database and vectorStore check results

---

### T096: API Layer Unit Tests

**PRD Reference:** N/A (quality)
**Depends on:** T091, T092, T093, T094, T002
**Blocks:** Nothing
**User Stories:** US-14, US-15
**Estimated scope:** 1 hour 30 min

#### Description

Write unit tests for all API routes. Test request validation, response format, and error handling.

#### Acceptance Criteria

- [ ] POST /api/chat: valid request → 200, invalid request → 400, agent error → 500
- [ ] POST /api/chat/stream: valid request → SSE stream, invalid → 400
- [ ] GET /api/conversations/[sessionId]: valid → 200 with messages, not found → 404
- [ ] GET /api/health: healthy → 200, degraded → 503
- [ ] All responses follow the standard JSON envelope format

#### Files to Create/Modify

- `src/app/api/__tests__/chat.test.ts` — (create) chat endpoint tests
- `src/app/api/__tests__/health.test.ts` — (create) health endpoint tests
- `src/app/api/__tests__/conversations.test.ts` — (create) conversation endpoint tests

#### Implementation Notes

- Mock the agent runtime (`runSandraAgent`, `runSandraAgentStream`)
- Mock Prisma for health check and conversation endpoints
- Test Next.js route handlers by calling the exported `POST`/`GET` functions directly with mock `NextRequest` objects
- Create a helper `mockNextRequest(method, body?, params?)` for test convenience
- Verify response status codes and JSON body shapes

#### Evaluation Checklist

- [ ] `npx vitest run src/app/api/__tests__/` — all tests pass

---

### T097: Chat Container Component

**PRD Reference:** Section 5 (Web), Section 6 (Conversational AI)
**Depends on:** Nothing (UI can start with mock data)
**Blocks:** T098, T100, T101, T103, T105, T106
**User Stories:** US-16
**Estimated scope:** 1 hour

#### Description

Create the main chat container component that renders the message list and input area.

#### Acceptance Criteria

- [ ] `ChatContainer` component renders a scrollable message list and fixed input area
- [ ] Messages display with different styling for user (right-aligned) and assistant (left-aligned) roles
- [ ] Message bubbles show content and a timestamp
- [ ] Auto-scrolls to the latest message when new messages arrive
- [ ] Uses Tailwind CSS for all styling

#### Files to Create/Modify

- `src/components/chat/ChatContainer.tsx` — (create) main chat container
- `src/components/chat/MessageBubble.tsx` — (create) individual message display
- `src/components/chat/index.ts` — (create) component exports

#### Implementation Notes

- Use React 19 with `'use client'` directive (client component for interactivity)
- State: `messages: Array<{ role: 'user' | 'assistant', content: string, createdAt: string }>`
- Layout: flex column, message list `flex-1 overflow-y-auto`, input area at bottom
- User messages: `bg-blue-500 text-white ml-auto`, Assistant: `bg-gray-100 text-gray-900 mr-auto`
- Auto-scroll: `useEffect` with `scrollIntoView` on a ref at the bottom of the message list
- Use `lucide-react` for icons (already in dependencies)

#### Evaluation Checklist

- [ ] Component renders without errors
- [ ] User and assistant messages have visually distinct styling

---

### T098: Message Input with Send Functionality

**PRD Reference:** Section 5 (Web)
**Depends on:** T097
**Blocks:** T106
**User Stories:** US-16
**Estimated scope:** 45 min

#### Description

Create the message input component with a text field, send button, and keyboard handling.

#### Acceptance Criteria

- [ ] Text input field with placeholder "Ask Sandra a question..."
- [ ] Send button that submits the message
- [ ] Enter key submits (Shift+Enter for new line)
- [ ] Input is disabled while waiting for a response (loading state)
- [ ] Empty messages are prevented (send button disabled when input is empty)
- [ ] Input clears after sending

#### Files to Create/Modify

- `src/components/chat/MessageInput.tsx` — (create) input component

#### Implementation Notes

- Props: `onSend: (message: string) => void`, `isLoading: boolean`
- Use `textarea` for multi-line support with `rows={1}` and auto-resize
- Handle Enter key: `if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(message); }`
- Disable send button and input when `isLoading` is true
- Use Tailwind: `border rounded-lg p-2 resize-none focus:ring-2 focus:ring-blue-500`

#### Evaluation Checklist

- [ ] Input submits on Enter
- [ ] Send button is disabled when input is empty or loading

---

### T099: API Client Service

**PRD Reference:** Section 14 (Backend Server)
**Depends on:** T091, T092
**Blocks:** T100, T106
**User Stories:** US-16, US-17
**Estimated scope:** 45 min

#### Description

Create a client-side service module that handles communication with the chat API, including both regular and streaming requests.

#### Acceptance Criteria

- [ ] `sendMessage(params: { message, sessionId?, language? })` sends to POST /api/chat and returns the response
- [ ] `streamMessage(params: { message, sessionId?, language? }, onToken: (token: string) => void)` connects to SSE streaming
- [ ] `getConversation(sessionId: string)` fetches conversation history
- [ ] Streaming handles: token events, tool_call events, done event, error event
- [ ] Network errors throw with user-friendly messages

#### Files to Create/Modify

- `src/lib/client/chat-api.ts` — (create) client-side API service
- `src/lib/client/index.ts` — (create) client exports

#### Implementation Notes

- This runs in the browser — use `fetch` API
- For streaming: use `fetch` + `ReadableStream` reader, parse SSE events manually
- SSE parsing: split on `\n\n`, extract `data:` prefix, parse JSON
- `streamMessage` accepts callback for each token, resolves with final response and sessionId
- Handle 400/500 responses: parse error envelope and throw descriptive error
- Base URL: use relative paths (`/api/chat`) — Next.js handles routing

#### Evaluation Checklist

- [ ] `sendMessage` fetches from /api/chat and returns parsed response
- [ ] `streamMessage` parses SSE events correctly

---

### T100: Streaming Response Rendering

**PRD Reference:** Section 5 (Web)
**Depends on:** T097, T099
**Blocks:** T106
**User Stories:** US-17
**Estimated scope:** 1 hour

#### Description

Wire the chat container to use streaming: tokens appear word-by-word as they arrive from the SSE endpoint.

#### Acceptance Criteria

- [ ] When user sends a message, streaming begins immediately
- [ ] Tokens are appended to a "in-progress" assistant message as they arrive
- [ ] The in-progress message updates in real-time (no flickering)
- [ ] On stream completion, the message is finalized
- [ ] Tool call events optionally show a "Searching..." indicator

#### Files to Create/Modify

- `src/components/chat/ChatContainer.tsx` — (modify) integrate streaming via chat API service
- `src/components/chat/StreamingMessage.tsx` — (create) component for in-progress streaming messages

#### Implementation Notes

- Use `useState` for the streaming content buffer
- Call `streamMessage()` with an `onToken` callback that appends to the buffer
- Render the buffer as a message bubble with a "streaming" visual indicator (e.g., blinking cursor)
- On `done` event: move the buffer content to the messages array as a final assistant message
- Use `useRef` for the buffer to avoid stale closure issues in the callback
- Performance: use `requestAnimationFrame` or batch state updates to prevent excessive re-renders

#### Evaluation Checklist

- [ ] Streaming text appears progressively in the chat
- [ ] Final message is complete after stream ends

---

### T101: Typing Indicator Component

**PRD Reference:** Section 5 (Web)
**Depends on:** T097
**Blocks:** T106
**User Stories:** US-17
**Estimated scope:** 30 min

#### Description

Create a typing indicator that shows when Sandra is processing a response.

#### Acceptance Criteria

- [ ] Three-dot animated typing indicator ("..." with bounce animation)
- [ ] Shows when `isLoading` is true and no streaming content has arrived yet
- [ ] Hides once streaming begins (replaced by StreamingMessage)
- [ ] Positioned like an assistant message (left-aligned)

#### Files to Create/Modify

- `src/components/chat/TypingIndicator.tsx` — (create) animated typing indicator

#### Implementation Notes

- Three dots with staggered animation: `animate-bounce` with `animation-delay`
- CSS: `@keyframes bounce` or Tailwind's `animate-bounce` with custom delays
- Wrap in a message-bubble-shaped container matching assistant message style
- Conditionally rendered: `{isLoading && !streamingContent && <TypingIndicator />}`

#### Evaluation Checklist

- [ ] Typing indicator animates with three dots
- [ ] Component renders and unmounts without errors

---

### T102: Session Continuity

**PRD Reference:** Section 5 (Web)
**Depends on:** T097, T099, T093 (conversations endpoint)
**Blocks:** T106
**User Stories:** US-16
**Estimated scope:** 45 min

#### Description

Implement session continuity so that refreshing the page restores the conversation.

#### Acceptance Criteria

- [ ] Session ID stored in `localStorage` after first message
- [ ] On page load, check localStorage for existing sessionId
- [ ] If sessionId exists, fetch conversation history via `getConversation()`
- [ ] Restored messages display in the chat
- [ ] If session fetch fails (expired/deleted), start a new session

#### Files to Create/Modify

- `src/components/chat/ChatContainer.tsx` — (modify) add session persistence logic
- `src/hooks/useSession.ts` — (create) session management hook

#### Implementation Notes

- `useSession` hook: `{ sessionId, setSessionId, clearSession }`
- On mount: `const storedId = localStorage.getItem('sandra_session_id')`
- On first response: `localStorage.setItem('sandra_session_id', sessionId)`
- Use `useEffect` on mount to restore conversation: `if (sessionId) fetchHistory(sessionId)`
- Handle 404 from conversations endpoint: clear localStorage and start fresh
- Use a unique key like `sandra_session_id` to avoid conflicts

#### Evaluation Checklist

- [ ] Session ID persists across page reloads
- [ ] Conversation history is restored on reload

---

### T103: Empty State with Suggested Questions

**PRD Reference:** Section 5 (Web), Section 6 (Conversational AI)
**Depends on:** T097, T026 (language types)
**Blocks:** T106
**User Stories:** US-19
**Estimated scope:** 30 min

#### Description

Create an empty state that shows when no messages exist, with suggested questions to help users get started.

#### Acceptance Criteria

- [ ] Empty state shows Sandra's greeting and 4 clickable suggested questions
- [ ] Suggested questions are relevant to EdLight services
- [ ] Clicking a question sends it as a user message
- [ ] Empty state disappears once conversation begins
- [ ] Questions display in the selected language

#### Files to Create/Modify

- `src/components/chat/EmptyState.tsx` — (create) empty state with suggestions

#### Implementation Notes

- Suggested questions per language:
  - EN: "How can I learn coding?", "What scholarships are available?", "Tell me about EdLight programs", "What news should I know today?"
  - FR: "Comment puis-je apprendre à coder ?", "Quelles bourses sont disponibles ?", "Parlez-moi des programmes EdLight", "Quelles nouvelles dois-je connaître ?"
  - HT: "Kijan mwen ka aprann kode?", "Ki bous ki disponib?", "Pale m de pwogram EdLight yo", "Ki nouvèl mwen ta dwe konnen jodi a?"
- Props: `onSelectQuestion: (question: string) => void`, `language: Language`
- Display Sandra's greeting from `LanguageConfig` (T026)
- Style: centered, cards or chips layout, `cursor-pointer hover:bg-blue-50`

#### Evaluation Checklist

- [ ] Empty state renders with 4 suggested questions
- [ ] Clicking a question triggers `onSelectQuestion`

---

### T104: Language Selector Component

**PRD Reference:** Section 11 (Multilingual Support)
**Depends on:** T026 (language types)
**Blocks:** T106
**User Stories:** US-04
**Estimated scope:** 30 min

#### Description

Create a language selector that allows users to choose their preferred language.

#### Acceptance Criteria

- [ ] Dropdown or button group showing: English, Français, Kreyòl Ayisyen
- [ ] Selected language is highlighted
- [ ] Changing language updates the chat API requests
- [ ] Language preference stored in localStorage
- [ ] Selector positioned in the chat header area

#### Files to Create/Modify

- `src/components/chat/LanguageSelector.tsx` — (create) language selector component

#### Implementation Notes

- Use native `<select>` element for simplicity and accessibility
- Options: `[{ value: 'en', label: 'English' }, { value: 'fr', label: 'Français' }, { value: 'ht', label: 'Kreyòl Ayisyen' }]`
- Props: `language: Language`, `onChange: (lang: Language) => void`
- Store selection: `localStorage.setItem('sandra_language', lang)`
- Read on mount: `localStorage.getItem('sandra_language') || 'en'`

#### Evaluation Checklist

- [ ] Selector renders with three language options
- [ ] Selecting a language triggers onChange

---

### T105: Responsive Layout

**PRD Reference:** Section 5 (Web), Section 11 (Low-Bandwidth Accessibility)
**Depends on:** T097, T098
**Blocks:** T106
**User Stories:** US-18
**Estimated scope:** 1 hour

#### Description

Ensure the chat interface is responsive and works well on mobile devices (320px minimum width) and desktop.

#### Acceptance Criteria

- [ ] Chat fills viewport height on mobile (no extra scrolling)
- [ ] Message bubbles max-width: 80% on desktop, 90% on mobile
- [ ] Input area is easily tappable on touch devices (min-height: 44px)
- [ ] Font sizes readable on small screens (min 14px)
- [ ] No horizontal scrolling on any viewport width ≥ 320px
- [ ] Chat container has max-width on large screens (e.g., 768px) centered

#### Files to Create/Modify

- `src/components/chat/ChatContainer.tsx` — (modify) add responsive styles
- `src/app/page.tsx` — (modify) integrate chat component as the main page

#### Implementation Notes

- Use Tailwind responsive prefixes: `sm:`, `md:`, `lg:`
- Mobile-first: default styles for mobile, then add desktop overrides
- Container: `w-full max-w-3xl mx-auto h-screen flex flex-col`
- Message area: `flex-1 overflow-y-auto px-4 py-2`
- Input area: `p-4 border-t` with `safe-area-inset-bottom` for iOS
- Test with Chrome DevTools device toolbar at 320px, 375px, 768px, 1024px

#### Evaluation Checklist

- [ ] Chat renders correctly at 320px viewport width
- [ ] No horizontal overflow at any standard viewport size
- [ ] Input is tappable on touch devices (44px+ height)

---

### T106: Chat UI Component Tests

**PRD Reference:** N/A (quality)
**Depends on:** T097, T098, T099, T100, T101, T102, T103, T104, T105
**Blocks:** Nothing
**User Stories:** US-16, US-17, US-18, US-19
**Estimated scope:** 1 hour

#### Description

Write component tests for the chat UI. Focus on behavior testing rather than snapshot testing.

#### Acceptance Criteria

- [ ] ChatContainer: renders messages, handles send
- [ ] MessageInput: submit on Enter, disabled when loading, empty prevention
- [ ] EmptyState: renders suggested questions, click sends message
- [ ] LanguageSelector: renders options, onChange fires

#### Files to Create/Modify

- `src/components/chat/__tests__/ChatContainer.test.tsx` — (create) container tests
- `src/components/chat/__tests__/MessageInput.test.tsx` — (create) input tests
- `src/components/chat/__tests__/EmptyState.test.tsx` — (create) empty state tests

#### Implementation Notes

- Install `@testing-library/react` and `@testing-library/jest-dom` as devDependencies
- Add `environment: 'jsdom'` to vitest config for component tests (or a separate config)
- Mock the chat API service for container tests
- Use `fireEvent` or `userEvent` for interaction testing
- Test that sending a message: clears input, shows user message, shows typing indicator
- Focus on user-visible behavior, not implementation details

#### Evaluation Checklist

- [ ] `npx vitest run src/components/chat/__tests__/` — all tests pass

---

### T107: API Key Authentication Middleware

**PRD Reference:** Section 15 (Security and Privacy)
**Depends on:** T015 (error handling), T016 (env config)
**Blocks:** T108, T109, T111
**User Stories:** US-20
**Estimated scope:** 30 min

#### Description

Create middleware that validates an API key for admin endpoints.

#### Acceptance Criteria

- [ ] `requireAdminAuth(request: NextRequest)` validates the API key from the request
- [ ] API key read from `x-api-key` header
- [ ] Compared against `ADMIN_API_KEY` from environment config
- [ ] Missing or invalid key throws `AuthError` (401)
- [ ] If `ADMIN_API_KEY` is not set in env, admin endpoints are disabled (return 503)

#### Files to Create/Modify

- `src/lib/utils/auth.ts` — (create) admin auth middleware

#### Implementation Notes

- Simple API key comparison: `request.headers.get('x-api-key') === env.ADMIN_API_KEY`
- Use timing-safe comparison to prevent timing attacks: `crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))`
- Return `AuthError` for invalid key, with message: "Invalid or missing API key"
- If `ADMIN_API_KEY` env is not set, throw a clear error: "Admin endpoints are not configured"

#### Evaluation Checklist

- [ ] Valid API key passes authentication
- [ ] Invalid API key returns AuthError

---

### T108: GET /api/repos Endpoint

**PRD Reference:** Section 8 (Automatic Ecosystem Expansion)
**Depends on:** T107, T090, T013 (repo data access)
**Blocks:** T111
**User Stories:** US-21
**Estimated scope:** 30 min

#### Description

Implement the admin endpoint to list all registered repositories with their indexing status.

#### Acceptance Criteria

- [ ] GET /api/repos requires API key authentication
- [ ] Returns: `{ success: true, data: { repos: [...], totalDocuments: number } }`
- [ ] Each repo includes: name, displayName, url, syncStatus, lastIndexedAt, documentCount
- [ ] Repos sorted by name alphabetically
- [ ] Sync status values formatted as: "not_indexed", "indexing", "indexed", "error"
- [ ] Timestamps formatted as ISO 8601 strings
- [ ] Document counts are integers
- [ ] Error details included when status is "error"

#### Files to Create/Modify

- `src/app/api/repos/route.ts` — (modify) complete GET handler
- `src/app/api/index/route.ts` — (verify) ensure response formatting consistency

#### Implementation Notes

- File already exists — review and complete
- Use `requireAdminAuth(request)` at the top of the handler
- Use `getActiveRepos()` from data access helpers
- For documentCount, join with IndexedDocument count per source
- `totalDocuments`: sum of all documentCounts across repos
- Map Prisma dates to ISO strings: `date.toISOString()`
- Map enum values to lowercase strings
- Include `lastIndexedAt: null` for repos that have never been indexed

#### Evaluation Checklist

- [ ] `curl /api/repos -H 'x-api-key: valid'` returns repo list
- [ ] `curl /api/repos` without API key returns 401
- [ ] API responses have consistent date and status formatting

---

### T109: POST /api/index Endpoint

**PRD Reference:** Section 8 (Automatic Ecosystem Expansion)
**Depends on:** T107, T090, T072 (indexing orchestrator)
**Blocks:** T111
**User Stories:** US-20
**Estimated scope:** 45 min

#### Description

Implement the admin endpoint to trigger repository indexing.

#### Acceptance Criteria

- [ ] POST /api/index requires API key authentication
- [ ] Accepts body: `{ repoId: string }`
- [ ] Validates input with `indexInputSchema`
- [ ] Calls `indexRepository(repoId)` and returns the result
- [ ] Non-existent repo returns 404
- [ ] Returns: `{ success: true, data: IndexingResult }`

#### Files to Create/Modify

- `src/app/api/index/route.ts` — (modify) complete POST handler

#### Implementation Notes

- File may already exist — review and complete
- Use `requireAdminAuth(request)` for authentication
- Validate repoId with `indexInputSchema`
- Look up repo first: if not found, return 404 NotFoundError
- Call `indexRepository(repoId)` — this may take time, so consider:
  - V1: synchronous — wait for completion and return result (simpler)
  - The indexing could take 30+ seconds for large repos — set appropriate timeout
- Return the `IndexingResult` from the indexer

#### Evaluation Checklist

- [ ] `curl -X POST /api/index -H 'x-api-key: valid' -d '{"repoId":"..."}'` triggers indexing
- [ ] Non-existent repoId returns 404

---

### T111: Admin Endpoints Unit Tests

**PRD Reference:** N/A (quality)
**Depends on:** T107, T108, T109, T002
**Blocks:** Nothing
**User Stories:** US-20, US-21
**Estimated scope:** 45 min

#### Description

Write unit tests for admin endpoints: authentication, repo listing, and indexing trigger.

#### Acceptance Criteria

- [ ] Auth middleware tests: valid key passes, invalid key rejects, missing key rejects
- [ ] GET /api/repos tests: returns repo list with auth, rejects without auth
- [ ] POST /api/index tests: triggers indexing with auth, rejects invalid repoId, rejects without auth

#### Files to Create/Modify

- `src/lib/utils/__tests__/auth.test.ts` — (create) auth middleware tests
- `src/app/api/__tests__/repos.test.ts` — (create) repos endpoint tests
- `src/app/api/__tests__/index.test.ts` — (create) index endpoint tests

#### Implementation Notes

- Mock the environment config to provide a test API key
- Mock Prisma for repo queries
- Mock `indexRepository()` for indexing trigger tests
- Test that admin endpoints return 401 without x-api-key header

#### Evaluation Checklist

- [ ] `npx vitest run src/lib/utils/__tests__/auth.test.ts src/app/api/__tests__/repos.test.ts src/app/api/__tests__/index.test.ts` — all pass
