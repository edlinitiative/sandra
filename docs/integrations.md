# Sandra — Integrations

## GitHub Integration

### Architecture
Sandra integrates with GitHub to automatically index EdLight repository content.

```
Repository Registry (config)
        │
        ▼
GitHub Client (API)
        │
        ▼
Fetcher (traverse repo, download files)
        │
        ▼
Indexer (chunk, embed, store)
        │
        ▼
Vector Store (searchable knowledge)
```

### Repository Registry
Repos are registered in `src/lib/github/config.ts`. Each entry specifies:
- Owner and repo name
- Display name and description
- Branch to index
- Docs path (optional)
- Active status

### GitHub Client
Low-level API client (`src/lib/github/client.ts`) that handles:
- Authentication via `GITHUB_TOKEN`
- Directory listing
- File content fetching (base64 decode)
- README fetching
- Repository metadata

### Fetcher
The fetcher (`src/lib/github/fetcher.ts`) recursively traverses repos:
- Fetches README first
- Traverses docs directories
- Fetches top-level markdown files
- Filters by file extension and size
- Deduplicates results

Indexable extensions: `.md`, `.mdx`, `.txt`, `.rst`, `.json`, `.yaml`, `.yml`, `.toml`, `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, and more.

### Indexer
The indexer (`src/lib/github/indexer.ts`) orchestrates the full pipeline:
1. Fetch all indexable files from a repo
2. Convert to `RawDocument` format
3. Remove old indexed content for the source
4. Run through the ingest pipeline (chunk → embed → store)

### Triggering Indexing
- **Manual**: Admin panel button or `POST /api/index`
- **Future**: GitHub webhooks on push events
- **Future**: Scheduled cron jobs

## Channel Integrations

### Current: Web Chat
Fully implemented. Messages flow through the web channel adapter which normalizes form data into `InboundMessage` format.

### Planned: WhatsApp
- Integration via Meta WhatsApp Business Cloud API
- Webhook endpoint for incoming messages
- Message sending via the WhatsApp API
- Support for text messages, with future media support

### Planned: Instagram
- Integration via Meta Instagram Messaging API
- Similar webhook pattern to WhatsApp
- Text message support initially

### Planned: Email
- Inbound: webhook from email provider (SendGrid, SES, etc.)
- Outbound: SMTP or API-based sending
- HTML formatting for rich responses

### Planned: Voice
- Integration via Twilio or WebRTC
- Speech-to-text for inbound
- Text-to-speech for outbound
- Real-time streaming capability

## AI Provider Integration

### Current: OpenAI
- Chat completion via `gpt-4o` (configurable)
- Embeddings via `text-embedding-3-small` (configurable)
- Tool/function calling support

### Future: Anthropic
- Implement `AIProvider` interface with Claude API
- Swap via configuration

### Future: Google
- Implement `AIProvider` interface with Gemini API
- Swap via configuration

## Vector Store Integration

### Current: In-Memory
- Brute-force cosine similarity search
- Suitable for development and small datasets
- No persistence across restarts

### Future Options
| Provider | Pros | Cons |
|----------|------|------|
| pgvector | Uses existing PostgreSQL | Scale limits |
| Pinecone | Managed, easy scaling | Cost, vendor lock-in |
| Qdrant | Open source, performant | Self-hosted complexity |
| Weaviate | Full-featured | Heavier setup |

Migration path: Implement the `VectorStore` interface for the chosen provider and update `getVectorStore()` to return the new implementation.

## Database Integration

### Current: Prisma + PostgreSQL
Schema defined in `prisma/schema.prisma`. Tables:
- `User`, `Session`, `Message` — Conversation data
- `Memory` — Long-term user facts
- `IndexedSource`, `IndexedDocument` — Knowledge base
- `RepoRegistry` — GitHub repo tracking

### Connection
Via `DATABASE_URL` environment variable. Prisma client is a singleton with hot-reload protection.
