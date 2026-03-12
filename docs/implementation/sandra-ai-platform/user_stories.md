# Sandra AI Platform User Stories

## Summary

21 user stories across 5 categories.

## Personas

| Persona | Description |
|---------|-------------|
| Student | Primary user — student or young professional in Haiti seeking educational resources, programs, and opportunities |
| Educator | Secondary user — educator, volunteer, or EdLight program participant |
| Admin | EdLight team member managing the knowledge base and platform |
| Partner | Donor or international partner exploring EdLight initiatives |
| Developer | Engineer building and maintaining the Sandra platform |

## Traceability Matrix

| US ID | Title | Feature | Task(s) | Status |
|-------|-------|---------|---------|--------|
| US-01 | Database schema setup | F10 | T010, T011, T012, T013, T014 | [ ] |
| US-02 | Structured error handling | F12 | T015, T016, T017, T018, T019, T123, T126 | [ ] |
| US-03 | LLM provider integration | F8 | T020, T021, T022, T023, T024, T025 | [ ] |
| US-04 | Language selection | F7 | T026, T027, T028, T029, T104, T122 | [ ] |
| US-05 | Conversation persistence | F6 | T030, T031, T034, T124 | [ ] |
| US-06 | Session context continuity | F6 | T032, T033, T034, T124 | [ ] |
| US-07 | Tool-based data access | F5 | T035, T036, T037, T038, T039, T040 | [ ] |
| US-08 | Knowledge base search | F3 | T041, T042, T043, T044, T045, T046 | [ ] |
| US-09 | Conversational Q&A | F2 | T060, T061, T062, T063, T067, T120 | [ ] |
| US-10 | Multi-turn reasoning | F2 | T063, T064, T065, T066, T067, T068 | [ ] |
| US-11 | Ecosystem navigation | F2 | T061, T063, T067, T068 | [ ] |
| US-12 | Repository indexing | F4 | T069, T070, T072, T073, T075, T121 | [ ] |
| US-13 | Incremental re-indexing | F4 | T071, T072, T074, T075, T121 | [ ] |
| US-14 | Chat API endpoint | F9 | T090, T091, T092, T093, T095, T096 | [ ] |
| US-15 | Health check endpoint | F9 | T094, T096 | [ ] |
| US-16 | Web chat interaction | F1 | T097, T098, T099, T102, T105, T106, T120 | [ ] |
| US-17 | Streaming responses | F1 | T100, T101, T106 | [ ] |
| US-18 | Mobile-friendly chat | F1 | T105, T106 | [ ] |
| US-19 | Suggested questions | F1 | T103, T106 | [ ] |
| US-20 | Trigger repository indexing | F11 | T107, T109, T111 | [ ] |
| US-21 | View indexing status | F11 | T107, T108, T110, T111 | [ ] |

---

## Stories by Category

### Foundation Setup (US-01 through US-04)

#### US-01: Database Schema Setup

> As a developer, I want a complete and migrated database schema so that all platform features have a reliable data layer to build on.

**Acceptance Criteria:**
- [ ] Prisma schema defines all V1 models: User, Session, Message, Memory, IndexedSource, IndexedDocument, RepoRegistry
- [ ] Running `prisma migrate deploy` applies all migrations without errors
- [ ] Seed script populates RepoRegistry with the four EdLight repositories (code, EdLight-News, EdLight-Initiative, EdLight-Academy)
- [ ] Prisma client is generated and all models are accessible with full TypeScript types
- [ ] Each model has appropriate indexes for query performance (e.g., Session by userId, Message by sessionId)

**Feature:** F10 | **Tasks:** T010–T014 | **Priority:** Must-have

---

#### US-02: Structured Error Handling

> As a developer, I want a consistent error handling framework so that all API routes return predictable error responses and failures are logged with context.

**Acceptance Criteria:**
- [ ] SandraError base class exists with subclasses for: ValidationError, AuthError, NotFoundError, ProviderError, ToolError
- [ ] Each error subclass includes a machine-readable error code and HTTP status mapping
- [ ] Environment secrets are validated at startup using Zod; missing required secrets cause a clear startup failure with the missing key names listed
- [ ] Structured logger outputs JSON logs with timestamp, level, message, and optional requestId
- [ ] Zod schemas exist for all API route input validation and produce user-friendly error messages

**Feature:** F12 | **Tasks:** T015–T019 | **Priority:** Must-have

---

#### US-03: LLM Provider Integration

> As a developer, I want an abstracted LLM provider interface so that the agent runtime can call an LLM without coupling to a specific vendor.

**Acceptance Criteria:**
- [ ] AIProvider interface defines methods for: chatCompletion (with tool support), streamChatCompletion, and generateEmbedding
- [ ] OpenAI implementation of AIProvider passes chat messages and receives completions with tool calls
- [ ] Streaming method yields token-by-token chunks that can be forwarded to SSE clients
- [ ] Embedding generation uses text-embedding-3-small and returns a float array
- [ ] Provider is instantiated via a factory function configured by environment variables

**Feature:** F8 | **Tasks:** T020–T025 | **Priority:** Must-have

---

#### US-04: Language Selection

> As a student, I want to interact with Sandra in my preferred language (Haitian Creole, French, or English) so that I can understand responses clearly.

**Acceptance Criteria:**
- [ ] Language enum defines three supported values: en, fr, ht
- [ ] API requests accept an optional `language` parameter that sets the response language
- [ ] System prompt helper generates language-specific instructions for the LLM (e.g., "Respond in Haitian Creole")
- [ ] Default language is English when no preference is specified
- [ ] User language preference is stored and retrieved for returning users within a session

**Feature:** F7 | **Tasks:** T026–T029 | **Priority:** Must-have

---

### Session & Memory (US-05 through US-06)

#### US-05: Conversation Persistence

> As a student, I want my conversation with Sandra to be saved so that I can return later and see my previous messages.

**Acceptance Criteria:**
- [ ] Each conversation is assigned a unique session ID upon creation
- [ ] Every message (user and assistant) is persisted to the Message table with role, content, timestamp, and session reference
- [ ] Retrieving a session by ID returns all messages in chronological order
- [ ] Sessions are associated with an optional user ID for future auth integration
- [ ] Deleting or expiring old sessions does not break active conversations

**Feature:** F6 | **Tasks:** T030–T034 | **Priority:** Must-have

---

#### US-06: Session Context Continuity

> As a student, I want Sandra to remember what I said earlier in the conversation so that I can ask follow-up questions without repeating myself.

**Acceptance Criteria:**
- [ ] The agent runtime loads the most recent N messages from the session before generating a response
- [ ] Follow-up questions like "Tell me more about that" correctly reference the prior assistant response
- [ ] Session context window has a configurable maximum message count to avoid exceeding LLM token limits
- [ ] Context loading completes within an acceptable time for sessions with up to 50 messages

**Feature:** F6 | **Tasks:** T030–T034 | **Priority:** Must-have

---

### Core Engine (US-07 through US-11)

#### US-07: Tool-Based Data Access

> As a developer, I want the agent to access all external data through registered tools so that data access is auditable, permission-scoped, and extensible.

**Acceptance Criteria:**
- [ ] Tool interface requires: name, description, inputSchema (Zod), requiredScopes, and handler function
- [ ] Tool registry allows registration and lookup by name at runtime
- [ ] Before executing a tool, the runtime MUST verify that the requesting context has the required permission scopes
- [ ] Tool execution errors are caught and returned to the agent as structured error messages, not thrown exceptions
- [ ] Three MVP tools are registered: searchKnowledgeBase, getEdLightInitiatives, lookupRepoInfo

**Feature:** F5 | **Tasks:** T035–T040 | **Priority:** Must-have

---

#### US-08: Knowledge Base Search

> As a student, I want Sandra to find relevant information from EdLight documentation so that I get accurate answers about programs and resources.

**Acceptance Criteria:**
- [ ] Documents are split into chunks using markdown-aware splitting that preserves heading context
- [ ] Each chunk is embedded using the AIProvider embedding method and stored in the vector store
- [ ] A search query is embedded and compared against stored chunks using cosine similarity
- [ ] The top-K most relevant chunks are returned with similarity scores and source metadata
- [ ] The retrieval module returns results within acceptable latency for interactive use (< 2 seconds)

**Feature:** F3 | **Tasks:** T041–T046 | **Priority:** Must-have

---

#### US-09: Conversational Q&A

> As a student, I want to ask Sandra questions in natural language and receive helpful, accurate responses so that I can learn about EdLight programs and opportunities.

**Acceptance Criteria:**
- [ ] The agent runtime accepts a user message and returns a natural language response
- [ ] The agent uses the searchKnowledgeBase tool when the question requires information from EdLight documentation
- [ ] Responses are grounded in retrieved knowledge — the agent does not fabricate program details
- [ ] The agent responds in the language specified by the request
- [ ] The full request-response cycle completes within acceptable latency for conversational interaction

**Feature:** F2 | **Tasks:** T060–T068 | **Priority:** Must-have

---

#### US-10: Multi-Turn Reasoning

> As a student, I want Sandra to use multiple tools in a single conversation turn if needed so that complex questions get complete answers.

**Acceptance Criteria:**
- [ ] The agent runtime supports a ReAct loop: LLM response → tool call → result → LLM response (repeating as needed)
- [ ] The loop terminates when the LLM produces a final text response with no tool calls
- [ ] A maximum iteration guard prevents infinite tool-calling loops (configurable, default 5)
- [ ] Each tool call and result is included in the LLM context for the next iteration
- [ ] The final response synthesizes information from all tool calls made during the turn

**Feature:** F2 | **Tasks:** T060–T068 | **Priority:** Must-have

---

#### US-11: Ecosystem Navigation

> As a student, I want Sandra to guide me to the right EdLight platform based on my question so that I don't have to search multiple websites myself.

**Acceptance Criteria:**
- [ ] When a user asks about coding, Sandra references EdLight Code and provides relevant links or guidance
- [ ] When a user asks about news, Sandra retrieves information from EdLight News content
- [ ] When a user asks about programs or leadership, Sandra references EdLight Initiative
- [ ] The agent uses lookupRepoInfo and getEdLightInitiatives tools to provide accurate platform information
- [ ] Responses include actionable next steps (e.g., "Visit EdLight Code to start learning" with context)

**Feature:** F2 | **Tasks:** T060–T068 | **Priority:** Must-have

---

### Knowledge Management (US-12 through US-13)

#### US-12: Repository Indexing

> As an admin, I want to trigger indexing of EdLight GitHub repositories so that Sandra's knowledge base stays up to date with the latest documentation.

**Acceptance Criteria:**
- [ ] The indexing system fetches README and documentation files from a specified GitHub repository
- [ ] Fetched content is processed through the full RAG pipeline: chunk → embed → store
- [ ] Each indexed document is tracked in the IndexedSource and IndexedDocument tables with source URL and timestamp
- [ ] The indexing job reports success or failure with details about documents processed
- [ ] Indexing completes successfully for all four EdLight repositories: code, EdLight-News, EdLight-Initiative, EdLight-Academy

**Feature:** F4 | **Tasks:** T069–T075 | **Priority:** Must-have

---

#### US-13: Incremental Re-Indexing

> As an admin, I want the indexing system to skip unchanged documents so that re-indexing is fast and cost-efficient.

**Acceptance Criteria:**
- [ ] Content hashes are computed and stored for each indexed document
- [ ] On re-index, the system compares current content hash with stored hash and skips unchanged documents
- [ ] Changed documents are re-chunked, re-embedded, and old embeddings are replaced
- [ ] The indexing job report includes counts of: skipped, updated, and newly added documents
- [ ] Re-indexing a repository with no changes completes quickly with zero embedding API calls

**Feature:** F4 | **Tasks:** T069–T075 | **Priority:** Should-have

---

### API & Interface (US-14 through US-21)

#### US-14: Chat API Endpoint

> As a developer, I want a well-defined chat API so that any client (web, mobile, or future channels) can send messages to Sandra and receive responses.

**Acceptance Criteria:**
- [ ] POST /api/chat accepts { message, sessionId (optional), language (optional) } and returns { success, data: { response, sessionId }, meta: { requestId } }
- [ ] If no sessionId is provided, a new session is created and its ID is returned
- [ ] GET /api/chat/stream returns an SSE stream that delivers response tokens incrementally
- [ ] GET /api/conversations/[sessionId] returns the full message history for a session
- [ ] All endpoints validate input with Zod and return structured error responses for invalid requests
- [ ] All responses include a unique requestId for tracing

**Feature:** F9 | **Tasks:** T090–T096 | **Priority:** Must-have

---

#### US-15: Health Check Endpoint

> As a developer, I want a health check endpoint so that monitoring systems can verify Sandra is running and its dependencies are accessible.

**Acceptance Criteria:**
- [ ] GET /api/health returns { status: "ok", timestamp } when the service is healthy
- [ ] The health check verifies database connectivity (Prisma can query)
- [ ] The endpoint responds within 5 seconds even under load
- [ ] An unhealthy state returns an appropriate HTTP error status with details about which dependency failed

**Feature:** F9 | **Tasks:** T090–T096 | **Priority:** Must-have

---

#### US-16: Web Chat Interaction

> As a student, I want to chat with Sandra through a web interface on EdLight websites so that I can ask questions and get help without leaving the site.

**Acceptance Criteria:**
- [ ] A chat component renders a message list and text input area
- [ ] Submitting a message displays it immediately in the chat and sends it to the API
- [ ] The assistant's response appears in the chat once received
- [ ] A loading/typing indicator is visible while waiting for the response
- [ ] The chat maintains session continuity — refreshing the page within the same browser session restores the conversation

**Feature:** F1 | **Tasks:** T097–T106 | **Priority:** Must-have

---

#### US-17: Streaming Responses

> As a student, I want to see Sandra's response appear word-by-word so that I know Sandra is working and I can start reading immediately.

**Acceptance Criteria:**
- [ ] The web chat client connects to the SSE streaming endpoint
- [ ] Response tokens are rendered incrementally as they arrive
- [ ] The typing indicator is shown at the start and removed when streaming completes
- [ ] Network interruptions during streaming display a user-friendly error message
- [ ] Streaming works correctly on low-bandwidth connections (tokens buffer and render progressively)

**Feature:** F1 | **Tasks:** T097–T106 | **Priority:** Must-have

---

#### US-18: Mobile-Friendly Chat

> As a student, I want the chat interface to work well on my phone so that I can access Sandra from a mobile device.

**Acceptance Criteria:**
- [ ] The chat layout is responsive and usable on screens as small as 320px wide
- [ ] The text input and send button are easily tappable on touch devices
- [ ] Message bubbles wrap text correctly and are readable on small screens
- [ ] The chat component does not require excessive client-side JavaScript (lightweight for low-bandwidth)

**Feature:** F1 | **Tasks:** T097–T106 | **Priority:** Must-have

---

#### US-19: Suggested Questions

> As a student visiting for the first time, I want to see suggested questions so that I know what Sandra can help with.

**Acceptance Criteria:**
- [ ] An empty chat state displays 3-5 suggested questions relevant to EdLight services
- [ ] Clicking a suggested question sends it as a user message and initiates a conversation
- [ ] Suggested questions are displayed in the user's selected language
- [ ] The suggested questions disappear once the conversation begins

**Feature:** F1 | **Tasks:** T097–T106 | **Priority:** Should-have

---

#### US-20: Trigger Repository Indexing

> As an admin, I want to trigger knowledge base indexing through an API so that I can update Sandra's information when documentation changes.

**Acceptance Criteria:**
- [ ] POST /api/index accepts { repoId } and initiates an indexing job for the specified repository
- [ ] The endpoint is protected by API key authentication (rejects requests without a valid key)
- [ ] The response includes a job identifier and initial status
- [ ] Attempting to index a non-existent repository returns a 404 error with a clear message
- [ ] Concurrent indexing requests for the same repository are handled gracefully (queued or rejected with explanation)

**Feature:** F11 | **Tasks:** T107–T111 | **Priority:** Must-have

---

#### US-21: View Indexing Status

> As an admin, I want to see the status of indexed repositories so that I know which repos are indexed and when they were last updated.

**Acceptance Criteria:**
- [ ] GET /api/repos returns a list of all registered repositories with: name, URL, indexing status, last indexed timestamp, and document count
- [ ] The endpoint is protected by API key authentication
- [ ] Repositories that have never been indexed show status "not_indexed" with null timestamp
- [ ] The response includes the total count of indexed documents across all repositories

**Feature:** F11 | **Tasks:** T107–T111 | **Priority:** Must-have
