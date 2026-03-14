# Sandra — AI Assistant for the EdLight Ecosystem

<p align="center">
  <strong>Sandra</strong> is the unified AI assistant for all EdLight initiatives.<br/>
  She supports Haitian Creole, French, and English.
</p>

---

## What is Sandra?

Sandra is the central conversational AI platform for the EdLight ecosystem. She is designed to:

- **Answer questions** about EdLight platforms and initiatives
- **Guide users** to the right EdLight platform for their needs
- **Support multilingual** interactions (English, French, Haitian Creole)
- **Index and learn** from EdLight GitHub repositories automatically
- **Use tools** to search knowledge, look up repositories, and take actions
- **Work across channels** — web chat, WhatsApp, Instagram, email, and voice

## EdLight Ecosystem

Sandra currently supports these EdLight initiatives:

| Platform | Repository | Description |
|----------|-----------|-------------|
| EdLight Code | [edlinitiative/code](https://github.com/edlinitiative/code) | Core codebase and platform |
| EdLight Academy | [edlinitiative/EdLight-Academy](https://github.com/edlinitiative/EdLight-Academy) | Educational platform and learning resources |
| EdLight News | [edlinitiative/EdLight-News](https://github.com/edlinitiative/EdLight-News) | News and community updates |
| EdLight Initiative | [edlinitiative/EdLight-Initiative](https://github.com/edlinitiative/EdLight-Initiative) | Organization and community hub |

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   Channels                       │
│   Web Chat │ WhatsApp │ Instagram │ Email │ Voice│
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   Sandra Agent  │  ← Orchestration loop
              │   Orchestrator  │    (tool calls, retrieval, memory)
              └────────┬────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ AI       │ │ Knowledge│ │  Tools   │
    │ Provider │ │ (RAG)    │ │ Registry │
    │ (OpenAI) │ │          │ │          │
    └──────────┘ └──────────┘ └──────────┘
          │            │            │
          │      ┌─────┴─────┐     │
          │      │  Vector   │     │
          │      │  Store    │     │
          │      └───────────┘     │
          │                        │
    ┌─────┴────────────────────────┴─────┐
    │           Memory Layer              │
    │   Session Memory │ User Memory      │
    └────────────────────────────────────┘
          │
    ┌─────┴─────────────┐
    │   GitHub Indexer   │
    │   (Repo content)   │
    └───────────────────┘
```

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL + Prisma
- **AI**: OpenAI (provider-agnostic abstraction)
- **Vector Store**: pgvector on PostgreSQL in production, with optional in-memory fallback for local development
 
## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL (optional for development — memory stores are used by default)
- OpenAI API key

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Configure required variables in .env:
#    OPENAI_API_KEY=sk-your-key-here          (required for AI)
#    ADMIN_API_KEY=your-admin-key-here        (required for /api/repos, /api/index)
#    GITHUB_TOKEN=ghp_your-token             (optional, for GitHub indexing)

# 4. Generate Prisma client
npm run db:generate

# 5. (Optional) Push schema to database
#    Requires PostgreSQL running
npm run db:push

# 6. Start development server
npm run dev
```

### Access

- **Home**: http://localhost:3000
- **Chat**: http://localhost:3000/chat
- **Admin**: http://localhost:3000/admin
- **Health**: http://localhost:3000/api/health

## How Indexing Works

1. Repositories are registered in `src/lib/github/config.ts`
2. The indexer fetches README and docs from each repo via GitHub API
3. Content is chunked into overlapping segments
4. Chunks are embedded using OpenAI embeddings
5. Embedded chunks are stored in the vector store
6. During chat, relevant chunks are retrieved via similarity search

Trigger indexing via:
- Admin panel → "Index All Repositories" button
- API: `POST /api/index`

## How the Agent Loop Works

1. User sends a message through a channel (web, WhatsApp, etc.)
2. The channel adapter normalizes the message
3. The agent loads session memory (conversation history) and user memory (long-term facts)
4. Retrieval: the knowledge base is searched for relevant context
5. A system prompt is built with identity, language, context, and tool awareness
6. The LLM is called with the full message history and tool definitions
7. If the LLM requests tool calls, they are executed and the loop continues
8. The final response is returned to the user
9. Messages are saved to session memory

## How to Add New Initiatives

1. Add a new entry to `DEFAULT_REPOS` in `src/lib/github/config.ts`:
   ```typescript
   {
     owner: 'edlinitiative',
     name: 'New-Repo',
     displayName: 'EdLight New Platform',
     description: 'Description of the new platform.',
     url: 'https://github.com/edlinitiative/New-Repo',
     branch: 'main',
     docsPath: 'docs/',
     isActive: true,
   }
   ```
2. Trigger indexing via the admin panel or API
3. Sandra will automatically include the new content in her knowledge base

## API Reference

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/chat` | Send a message to Sandra (JSON response) | None |
| `POST` | `/api/chat/stream` | Send a message, receive Server-Sent Events (streaming) | None |
| `GET` | `/api/conversations/[sessionId]` | Get conversation history | None |
| `GET` | `/api/repos` | List registered repositories with indexing status | API key |
| `POST` | `/api/index` | Trigger repo indexing (body: `{ repoId: "owner/repo" }`) | API key |
| `GET` | `/api/health` | System health check | None |

Admin endpoints (`/api/repos`, `/api/index`) require an `x-api-key` header matching `ADMIN_API_KEY`.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── chat/              # Chat page
│   ├── admin/             # Admin page
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── chat/             # Chat UI components
│   ├── admin/            # Admin UI components
│   ├── layout/           # Layout components
│   └── ui/               # Base UI primitives
└── lib/                   # Core business logic
    ├── agents/           # Sandra agent orchestration
    ├── ai/               # AI provider abstraction
    ├── channels/         # Channel adapters
    ├── config/           # Environment & constants
    ├── db/               # Database client
    ├── github/           # GitHub integration
    ├── i18n/             # Multilingual support
    ├── knowledge/        # RAG pipeline
    ├── memory/           # Session & user memory
    ├── tools/            # Tool framework
    └── utils/            # Shared utilities
```

## Documentation

- [Product Requirements](docs/PRD.md)
- [Architecture](docs/architecture.md)
- [Agent System](docs/agent-system.md)
- [Integrations](docs/integrations.md)
- [Roadmap](docs/roadmap.md)

## License

Internal — EdLight Initiative
