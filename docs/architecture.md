# Sandra — Architecture

## System Overview

Sandra is built as a Next.js application with a modular library layer that contains all business logic. The architecture follows clean separation of concerns: UI components never contain business logic, and the library layer is framework-agnostic where possible.

```
┌──────────────────────────────────────────────┐
│              Next.js App Layer                │
│  ┌────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ Pages  │  │ API      │  │ Server       │ │
│  │ (React)│  │ Routes   │  │ Actions      │ │
│  └───┬────┘  └────┬─────┘  └──────┬───────┘ │
│      │            │               │          │
│      └────────────┼───────────────┘          │
│                   │                          │
│   ┌───────────────▼──────────────────────┐   │
│   │         Library Layer (src/lib/)     │   │
│   │                                      │   │
│   │  ┌─────────┐  ┌──────────────────┐   │   │
│   │  │ Agents  │  │  Knowledge/RAG   │   │   │
│   │  │         │  │  - Chunker       │   │   │
│   │  │ - Sandra│  │  - Embeddings    │   │   │
│   │  │ - Prompt│  │  - Vector Store  │   │   │
│   │  │ - Tools │  │  - Retrieval     │   │   │
│   │  └─────────┘  └──────────────────┘   │   │
│   │                                      │   │
│   │  ┌─────────┐  ┌──────────────────┐   │   │
│   │  │   AI    │  │    Channels      │   │   │
│   │  │Provider │  │  - Web           │   │   │
│   │  │- OpenAI │  │  - WhatsApp      │   │   │
│   │  │- (...)  │  │  - Instagram     │   │   │
│   │  └─────────┘  │  - Email/Voice   │   │   │
│   │               └──────────────────┘   │   │
│   │                                      │   │
│   │  ┌─────────┐  ┌──────────────────┐   │   │
│   │  │ Memory  │  │    GitHub        │   │   │
│   │  │- Session│  │  - Client        │   │   │
│   │  │- User   │  │  - Fetcher       │   │   │
│   │  └─────────┘  │  - Indexer       │   │   │
│   │               └──────────────────┘   │   │
│   │                                      │   │
│   │  ┌─────────┐  ┌──────────────────┐   │   │
│   │  │ Config  │  │    Utils         │   │   │
│   │  │ - Env   │  │  - Errors        │   │   │
│   │  │ - Const │  │  - Logger        │   │   │
│   │  └─────────┘  │  - Validation    │   │   │
│   │               └──────────────────┘   │   │
│   └──────────────────────────────────────┘   │
│                                              │
│   ┌──────────────────────────────────────┐   │
│   │            Data Layer                │   │
│   │  Prisma + PostgreSQL  │  Vector Store│   │
│   └──────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Provider Abstraction
All AI functionality goes through the `AIProvider` interface. The OpenAI implementation is the first, but Anthropic and Google can be added by implementing the same interface. No code outside `src/lib/ai/` knows which provider is being used.

### 2. Agent Loop Pattern
Sandra uses a **ReAct-style agent loop**:
1. Receive input
2. Build context (memory, retrieval, tools)
3. Call LLM
4. If tool calls → execute → loop back to step 3
5. Return final response

This pattern is proven at scale and allows Sandra to evolve from a simple Q&A bot to a full agent that takes actions.

### 3. Memory Architecture
Two tiers:
- **Session memory** — Short-term conversation context. Lives in memory or Redis.
- **User memory** — Long-term facts about users. Persisted in PostgreSQL.

Both are behind interfaces so the storage backend can be swapped without changing the agent.

### 4. Knowledge/RAG Pipeline
Documents flow through: **Fetch → Chunk → Embed → Store → Retrieve**

Each step is a separate function/class, making it easy to:
- Change chunking strategies
- Swap embedding models
- Replace the vector store
- Add new document sources

### 5. Channel Normalization
Every channel adapter converts platform-specific payloads into a standard `InboundMessage` format. This means the agent doesn't need to know whether a message came from WhatsApp or the web.

### 6. Tool Registry
Tools are self-registering: they import the registry and add themselves. The agent reads from the registry at runtime. Adding a new tool is: create file → implement interface → import in index.ts.

## Data Flow: Chat Message

```
User types message in web UI
        │
        ▼
POST /api/chat { message, sessionId, language }
        │
        ▼
Zod validation
        │
        ▼
runSandraAgent(input)
        │
        ├── Load session memory (conversation history)
        ├── Load user memory (long-term facts)
        ├── Retrieve relevant knowledge (vector search)
        ├── Build system prompt
        │
        ▼
AI Provider: chatCompletion(messages + tools)
        │
        ├── If tool_calls: execute tools → loop
        │
        ▼
Return response
        │
        ├── Save to session memory
        │
        ▼
JSON response to client
```

## Configuration

All configuration is environment-variable driven with Zod validation at startup. The `env.ts` module fails fast in production if required variables are missing, and uses safe defaults in development.

## Error Handling

All errors flow through `SandraError` subclasses. API routes catch errors and return structured JSON responses with error codes. The logger provides structured output for debugging.

## Scalability Path

1. **Vector Store**: Replace `InMemoryVectorStore` with Pinecone/Qdrant/pgvector
2. **Memory**: Replace in-memory stores with Redis (session) and PostgreSQL (user)
3. **Indexing**: Add a job queue (BullMQ) for background indexing
4. **Channels**: Add webhook endpoints for WhatsApp/Instagram
5. **Auth**: Add NextAuth.js for user authentication
6. **Monitoring**: Add OpenTelemetry for observability
