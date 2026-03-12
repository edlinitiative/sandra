# Sandra — Product Requirements Document

## Vision

Sandra is the unified AI assistant for the EdLight ecosystem. She serves as the primary conversational interface for all EdLight initiatives, helping users navigate platforms, access documentation, and get answers to their questions.

## Goals

### Primary Goals
1. **Unified access point** — One assistant that knows about all EdLight platforms
2. **Multilingual** — Native support for English, French, and Haitian Creole
3. **Multi-channel** — Available via web, WhatsApp, Instagram, email, and voice
4. **Knowledge-aware** — Automatically indexes and learns from EdLight repositories
5. **Extensible** — Agent-based architecture that can take actions and integrate with APIs

### Non-Goals (for v0.1)
- Full production deployment
- Complete WhatsApp/Instagram/email/voice integrations
- User authentication and authorization
- Fine-tuned models
- Custom training data pipelines

## Target Users

1. **EdLight community members** — Seeking information about EdLight platforms
2. **EdLight developers** — Looking for documentation and code references
3. **New visitors** — Discovering what EdLight offers
4. **Haitian Creole speakers** — Accessing EdLight resources in their language

## User Stories

### As a community member:
- I want to ask Sandra what EdLight Academy offers so I can decide if it's right for me
- I want to ask questions in Haitian Creole and get responses in Haitian Creole
- I want Sandra to guide me to the right EdLight platform for my needs

### As a developer:
- I want to ask Sandra about EdLight's codebase and get accurate documentation references
- I want Sandra to look up specific repository information for me
- I want to trigger knowledge base indexing when repos are updated

### As an admin:
- I want to see which repositories are indexed and their status
- I want to manually trigger indexing for new or updated repos
- I want to monitor Sandra's health and system status

## Technical Requirements

### AI Provider
- Must support OpenAI as primary provider
- Architecture must allow swapping to Anthropic, Google, or other providers
- Embeddings and chat completion must be independently configurable

### Knowledge Base
- Must automatically index GitHub repository content
- Must support chunking, embedding, and semantic search
- Must be able to add new sources without code changes
- Must support incremental updates

### Memory
- Short-term session memory for conversation context
- Long-term user memory for preferences and facts
- Pluggable storage backends (in-memory → Redis/PostgreSQL)

### Channels
- Web chat must be fully functional in v0.1
- Other channels must have clean interfaces for future implementation
- All channels must normalize messages to a common format

### Languages
- English (en), French (fr), Haitian Creole (ht)
- System prompt must instruct the LLM to respond in the user's language
- Language detection should be supported in future versions

## Success Metrics

- Sandra can answer basic questions about all four EdLight platforms
- Sandra responds correctly in the user's preferred language
- The admin panel shows indexed repository status
- The agent loop successfully uses tools when appropriate
- The codebase is clean, documented, and ready for iteration

## Timeline

- **v0.1** (current) — Foundation scaffold with working web chat and agent loop
- **v0.2** — Database-backed memory, production vector store, GitHub webhook indexing
- **v0.3** — WhatsApp integration, improved RAG quality
- **v0.4** — Instagram and email channels, user authentication
- **v0.5** — Voice support, advanced agent capabilities
- **v1.0** — Production-ready multi-channel AI assistant
