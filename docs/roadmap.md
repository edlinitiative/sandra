# Sandra — Roadmap

## v0.1 — Foundation (Current)
**Status: Complete**

- [x] Project scaffolding (Next.js, TypeScript, Tailwind, Prisma)
- [x] AI provider abstraction (OpenAI implementation)
- [x] Sandra agent loop (ReAct pattern with tool calls)
- [x] System prompt builder (multilingual, context-aware)
- [x] Tool framework (registry, executor, validation)
- [x] Initial tools (searchKnowledgeBase, getEdLightInitiatives, lookupRepoInfo)
- [x] Knowledge/RAG pipeline (chunk, embed, store, retrieve)
- [x] In-memory vector store
- [x] Memory layer (session + user memory)
- [x] GitHub integration (client, fetcher, indexer)
- [x] EdLight repo registry (4 repos configured)
- [x] Channel abstraction (web fully wired, others stubbed)
- [x] Multilingual support (en, fr, ht)
- [x] Web chat UI
- [x] Admin dashboard
- [x] API routes (chat, conversations, repos, indexing, health)
- [x] Prisma schema (User, Session, Message, Memory, IndexedSource, IndexedDocument, RepoRegistry)
- [x] Documentation (README, PRD, architecture, agent system, integrations)

## v0.2 — Persistence & Quality
**Target: Next iteration**

- [ ] Connect memory stores to PostgreSQL (replace in-memory)
- [ ] Connect vector store to pgvector or Pinecone
- [ ] Implement database-backed session and message storage
- [ ] Implement database-backed repo registry (CRUD API)
- [ ] Improve RAG quality (better chunking, reranking)
- [ ] Add streaming responses to chat API
- [ ] Add user authentication (NextAuth.js)
- [ ] Add rate limiting
- [ ] GitHub webhook for auto-indexing on push
- [ ] Background job processing (BullMQ or similar)
- [ ] Comprehensive error handling and monitoring

## v0.3 — WhatsApp & RAG Improvements
**Target: After v0.2**

- [ ] WhatsApp channel integration (Meta Cloud API)
- [ ] Webhook endpoint for WhatsApp messages
- [ ] Language auto-detection
- [ ] Improved prompt engineering
- [ ] Conversation summarization for long sessions
- [ ] Tool: navigate users to specific EdLight pages
- [ ] Tool: search EdLight News articles
- [ ] Admin: conversation browser
- [ ] Admin: analytics dashboard

## v0.4 — More Channels
**Target: After v0.3**

- [ ] Instagram messaging integration
- [ ] Email channel (inbound + outbound)
- [ ] Multi-turn tool execution improvements
- [ ] User preference management UI
- [ ] Knowledge base admin (manual document upload)
- [ ] Custom tool builder (low-code)

## v0.5 — Voice & Advanced Agents
**Target: After v0.4**

- [ ] Voice channel (Twilio / WebRTC)
- [ ] Speech-to-text / text-to-speech pipeline
- [ ] Real-time streaming for voice
- [ ] Advanced agent planning (multi-step reasoning)
- [ ] Cross-channel session continuity
- [ ] User identity linking across channels
- [ ] Anthropic / Google provider implementations

## v1.0 — Production Release
**Target: After v0.5**

- [ ] Production infrastructure (deployment, scaling, monitoring)
- [ ] Full observability (OpenTelemetry, error tracking)
- [ ] Security hardening (input sanitization, prompt injection defense)
- [ ] Performance optimization (caching, connection pooling)
- [ ] Comprehensive test suite
- [ ] User onboarding flows
- [ ] Public API documentation
- [ ] Multi-tenant support (if needed)

## Future Ideas

- **Sandra for Classrooms** — Specialized mode for EdLight Academy
- **Sandra Developer Mode** — Code-aware assistant for EdLight Code contributors
- **Sandra Community** — Community management and moderation support
- **Proactive Sandra** — Outreach messages, reminders, and notifications
- **Sandra Plugins** — Third-party tool integrations
- **Fine-tuned Sandra** — Custom-trained model on EdLight content
- **Offline Sandra** — Edge deployment for low-connectivity areas
