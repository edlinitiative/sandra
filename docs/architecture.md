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


# Sandra — Full System Architecture

Organization: EdLight Initiative  
Project: Sandra  
Document Type: System Architecture  
Status: Draft  
Version: 1.0  

---

# 1. Purpose

Sandra is the central AI assistant and future agent layer for the EdLight ecosystem.

She is designed to become the unified conversational interface across EdLight platforms, allowing users to interact with EdLight services through natural language instead of navigating multiple websites or systems manually.

Sandra should support:

- Web chat
- WhatsApp
- Instagram
- Email
- Live voice interactions
- Haitian Creole, French, and English
- Knowledge retrieval across EdLight repositories and documentation
- Secure access to user-specific data when authorized
- Tool-based actions across EdLight systems

This architecture is designed to support both:

- a fast MVP
- a scalable long-term platform

---

# 2. High-Level Architecture

Sandra should be built as a layered system.

## Core Layers

1. Channel Layer  
2. Identity and Access Layer  
3. Agent Runtime Layer  
4. Tool and Gateway Layer  
5. Knowledge and Retrieval Layer  
6. Data Layer  
7. Integration Layer  
8. Worker and Automation Layer  
9. Admin and Observability Layer  

The central architectural principle is:

**All channels feed into one Sandra runtime, and Sandra interacts with systems only through controlled tools and internal services.**

Sandra must not be designed as a collection of disconnected bots.  
She should be one core system with multiple interfaces.

---

# 3. Architectural Principles

## 3.1 One Brain, Many Channels

Sandra should have one shared agent runtime and one shared tool layer.

Web chat, WhatsApp, Instagram, email, and voice should all send normalized requests into the same core system.

This ensures:

- consistent behavior
- shared memory
- easier maintenance
- easier rollout of new capabilities

---

## 3.2 Tool-Based System Access

Sandra should never be given unrestricted access to raw databases or random services.

Sandra should interact with systems through structured tools such as:

- `getUserCertificates`
- `getEnrollmentStatus`
- `getLatestNews`
- `searchKnowledgeBase`
- `getProgramDetails`
- `sendWhatsappReply`
- `draftEmail`

This keeps the system secure, auditable, and easier to evolve.

---

## 3.3 Public Knowledge and Private Data Must Be Separate

Sandra should support two different access modes:

### Public or system-level mode
Used for:

- FAQs
- public course information
- public program details
- public news summaries
- public EdLight documentation

### User-authorized mode
Used for:

- user certificates
- user enrollments
- application status
- user preferences
- private messages
- personalized guidance

Private data should only be accessed when the user is authenticated and authorized.

---

## 3.4 Fast MVP, Strong Long-Term Foundation

The MVP should be easy to ship.  
The long-term design should not force a rewrite.

That means:

- modular connectors
- modular tools
- a clean gateway layer
- a clear split between realtime app data and structured business data

---

# 4. System Diagram

```text
Users
  ├── Web Chat
  ├── WhatsApp
  ├── Instagram
  ├── Email
  └── Voice

Channels / Adapters
  ├── Web Adapter
  ├── WhatsApp Adapter
  ├── Instagram Adapter
  ├── Email Adapter
  └── Voice Adapter

Normalized Message Bus
  └── Sandra Request Format

Sandra Core Runtime
  ├── Session Manager
  ├── Language Handler
  ├── Memory Manager
  ├── Retrieval Manager
  ├── Tool Orchestrator
  └── Response Generator

Tool and Gateway Layer
  ├── Public Knowledge Tools
  ├── User Data Tools
  ├── Messaging Tools
  ├── Admin Tools
  └── Integration Tools

Backend Services
  ├── Sandra Gateway API
  ├── Repo Indexer
  ├── Sync Services
  ├── Worker Jobs
  └── Notification Services

Data Layer
  ├── Firebase Auth
  ├── Firestore
  ├── Postgres
  └── Vector Store

Connected Systems
  ├── EdLight Code
  ├── EdLight Academy
  ├── EdLight News
  ├── EdLight Initiative
  ├── GitHub
  ├── Email Provider
  ├── WhatsApp Provider
  └── Future Systems


  # Sandra — Data Model and API/Tool Contract Specification

Organization: EdLight Initiative  
Project: Sandra  
Document Type: Data Model and Interface Specification  
Status: Draft  
Version: 1.0  

---

# 1. Purpose

This document defines the core data model for Sandra and the contracts between:

- Sandra Runtime
- Sandra Gateway API
- internal tools
- connectors
- EdLight systems
- channel adapters

It is designed to complement the main architecture document.

This specification covers:

- Postgres data model
- Firestore data model
- vector knowledge model
- tool contract design
- API contract design
- permission model
- audit model

The goal is to ensure Sandra can scale from a simple assistant into a secure multi-system AI platform for the EdLight ecosystem.

---

# 2. Core Design Principles

## 2.1 Source-of-Truth Separation

Sandra should not store all data in one place.

Different categories of data should live in the storage layer best suited for them:

- Firestore for realtime conversation and client-facing interaction state
- Postgres for structured relational business and operational data
- Vector store for unstructured semantic knowledge retrieval

---

## 2.2 Tool-Mediated Data Access

Sandra Runtime must not directly access raw tables or collections.

All sensitive and structured data access should happen through:

- internal APIs
- tool contracts
- connectors

This ensures:

- cleaner architecture
- strict permission enforcement
- observability
- easier future refactoring

---

## 2.3 Public and Private Data Separation

Sandra must clearly separate:

### Public data
Examples:

- public initiative descriptions
- public course catalog
- public FAQs
- repo documentation
- public news content

### Private data
Examples:

- user enrollments
- certificates
- application status
- contact details
- consent records
- channel connection metadata

Private data should only be accessible with valid identity and permission checks.

---

# 3. Canonical Identity Model

Sandra should maintain a canonical user model in Postgres, while Firebase Auth acts as the main authentication provider.

## Identity Components

### Firebase Auth
Used for:

- sign-in
- token issuance
- session authentication
- role claims for app clients

### Postgres Canonical User
Used for:

- persistent user record
- cross-system identity mapping
- platform relationships
- internal permissions
- operational logic

## Identity Flow

1. user authenticates through Firebase Auth  
2. backend validates Firebase token  
3. backend maps Firebase UID to canonical user in Postgres  
4. Sandra Runtime uses canonical user ID internally  

This allows Sandra to keep one internal identity even if users interact across multiple EdLight systems.

---

# 4. Postgres Data Model

Postgres is the canonical structured data layer.

## 4.1 `users`

Stores the main canonical user record.

### Fields

- `id` UUID primary key
- `firebase_uid` text unique nullable
- `email` text unique nullable
- `phone_number` text nullable
- `full_name` text nullable
- `preferred_language` text nullable
- `country` text nullable
- `timezone` text nullable
- `status` text not null default `active`
- `created_at` timestamp not null
- `updated_at` timestamp not null

### Notes

This is the main record used across Sandra tools and connectors.

---

## 4.2 `user_identities`

Maps users to external or internal systems.

### Fields

- `id` UUID primary key
- `user_id` UUID foreign key to `users.id`
- `provider` text not null
- `provider_user_id` text not null
- `provider_email` text nullable
- `metadata` jsonb nullable
- `created_at` timestamp not null
- `updated_at` timestamp not null

### Example providers

- `firebase`
- `edlight_code`
- `edlight_academy`
- `github`
- `whatsapp`
- `instagram`
- `email`

### Notes

Used when the same user is known across multiple platforms.

---

## 4.3 `roles`

Defines system roles.

### Fields

- `id` UUID primary key
- `name` text unique not null
- `description` text nullable
- `created_at` timestamp not null
- `updated_at` timestamp not null

### Example roles

- `guest`
- `student`
- `admin`
- `program_manager`
- `operator`

---

## 4.4 `user_roles`

Maps users to roles.

### Fields

- `id` UUID primary key
- `user_id` UUID foreign key
- `role_id` UUID foreign key
- `created_at` timestamp not null

---

## 4.5 `permissions`

Defines individual permission scopes.

### Fields

- `id` UUID primary key
- `scope` text unique not null
- `description` text nullable
- `created_at` timestamp not null

### Example scopes

- `read:public_content`
- `read:own_profile`
- `read:own_courses`
- `read:own_certificates`
- `read:own_application_status`
- `send:whatsapp`
- `send:email`
- `admin:indexing`
- `admin:ops`

---

## 4.6 `role_permissions`

Maps roles to permissions.

### Fields

- `id` UUID primary key
- `role_id` UUID foreign key
- `permission_id` UUID foreign key
- `created_at` timestamp not null

---

## 4.7 `organizations`

Represents logical organizations or platform groupings.

### Fields

- `id` UUID primary key
- `name` text unique not null
- `type` text nullable
- `created_at` timestamp not null
- `updated_at` timestamp not null

### Example organizations

- `EdLight`
- `EdLight Code`
- `EdLight Academy`
- `EdLight News`

---

## 4.8 `initiatives`

Represents EdLight initiatives or products.

### Fields

- `id` UUID primary key
- `slug` text unique not null
- `name` text not null
- `description` text nullable
- `repo_url` text nullable
- `website_url` text nullable
- `status` text not null default `active`
- `created_at` timestamp not null
- `updated_at` timestamp not null

### Example initiatives

- `code`
- `academy`
- `news`
- `initiative`
- `eslp`

---

## 4.9 `courses`

Represents canonical course records.

### Fields

- `id` UUID primary key
- `initiative_id` UUID foreign key
- `external_course_id` text nullable
- `slug` text not null
- `title` text not null
- `description` text nullable
- `level` text nullable
- `language` text nullable
- `status` text not null default `active`
- `metadata` jsonb nullable
- `created_at` timestamp not null
- `updated_at` timestamp not null

---

## 4.10 `enrollments`

Stores course enrollment records.

### Fields

- `id` UUID primary key
- `user_id` UUID foreign key
- `course_id` UUID foreign key
- `status` text not null
- `progress_percent` numeric nullable
- `started_at` timestamp nullable
- `completed_at` timestamp nullable
- `created_at` timestamp not null
- `updated_at` timestamp not null

### Example statuses

- `not_started`
- `active`
- `completed`
- `paused`
- `cancelled`

---

## 4.11 `certificates`

Stores issued certificates.

### Fields

- `id` UUID primary key
- `user_id` UUID foreign key
- `course_id` UUID foreign key
- `certificate_url` text nullable
- `issued_at` timestamp nullable
- `status` text not null default `issued`
- `metadata` jsonb nullable
- `created_at` timestamp not null
- `updated_at` timestamp not null

---

## 4.12 `program_applications`

Stores applications to EdLight programs.

### Fields

- `id` UUID primary key
- `user_id` UUID foreign key
- `initiative_id` UUID foreign key
- `program_name` text not null
- `application_cycle` text nullable
- `status` text not null
- `submitted_at` timestamp nullable
- `decision_at` timestamp nullable
- `metadata` jsonb nullable
- `created_at` timestamp not null
- `updated_at` timestamp not null

### Example statuses

- `draft`
- `submitted`
- `under_review`
- `accepted`
- `rejected`
- `waitlisted`

---

## 4.13 `consents`

Stores user consent records.

### Fields

- `id` UUID primary key
- `user_id` UUID foreign key
- `consent_type` text not null
- `granted` boolean not null
- `granted_at` timestamp nullable
- `revoked_at` timestamp nullable
- `metadata` jsonb nullable
- `created_at` timestamp not null
- `updated_at` timestamp not null

### Example consent types

- `email_access`
- `whatsapp_messaging`
- `personalized_recommendations`
- `data_processing`
- `channel_linking`

---

## 4.14 `connector_registrations`

Stores connected system registrations.

### Fields

- `id` UUID primary key
- `connector_name` text not null
- `owner_type` text not null
- `owner_id` UUID nullable
- `status` text not null
- `config` jsonb nullable
- `created_at` timestamp not null
- `updated_at` timestamp not null

### Example connector names

- `github`
- `whatsapp`
- `instagram`
- `gmail`
- `edlight_code`
- `edlight_academy`

---

## 4.15 `connector_tokens_metadata`

Stores metadata about tokens, not necessarily raw token values if stored elsewhere.

### Fields

- `id` UUID primary key
- `connector_registration_id` UUID foreign key
- `token_type` text not null
- `scopes` jsonb nullable
- `expires_at` timestamp nullable
- `last_refreshed_at` timestamp nullable
- `metadata` jsonb nullable
- `created_at` timestamp not null
- `updated_at` timestamp not null

### Notes

Raw secrets may be stored in a secrets manager. This table tracks metadata and lifecycle.

---

## 4.16 `repo_registry`

Stores repositories Sandra can index.

### Fields

- `id` UUID primary key
- `name` text not null
- `full_name` text unique not null
- `repo_url` text not null
- `branch` text nullable
- `initiative_id` UUID nullable
- `indexing_enabled` boolean not null default true
- `sync_frequency` text nullable
- `status` text not null default `active`
- `metadata` jsonb nullable
- `created_at` timestamp not null
- `updated_at` timestamp not null

---

## 4.17 `indexed_sources`

Stores indexed sources at a source level.

### Fields

- `id` UUID primary key
- `repo_registry_id` UUID nullable
- `source_type` text not null
- `source_identifier` text not null
- `title` text nullable
- `checksum` text nullable
- `last_indexed_at` timestamp nullable
- `status` text not null
- `metadata` jsonb nullable
- `created_at` timestamp not null
- `updated_at` timestamp not null

### Example source types

- `github_readme`
- `github_doc`
- `website_page`
- `faq_page`
- `policy_doc`

---

## 4.18 `indexed_documents`

Stores chunked/indexed documents metadata.

### Fields

- `id` UUID primary key
- `indexed_source_id` UUID foreign key
- `document_key` text not null
- `chunk_index` integer not null
- `content_preview` text nullable
- `vector_id` text nullable
- `token_count` integer nullable
- `metadata` jsonb nullable
- `created_at` timestamp not null
- `updated_at` timestamp not null

### Notes

Actual vectors may live in the vector store. This table maintains relational metadata.

---

## 4.19 `index_jobs`

Tracks indexing jobs.

### Fields

- `id` UUID primary key
- `job_type` text not null
- `target_type` text not null
- `target_id` UUID nullable
- `status` text not null
- `started_at` timestamp nullable
- `completed_at` timestamp nullable
- `error_message` text nullable
- `metadata` jsonb nullable
- `created_at` timestamp not null
- `updated_at` timestamp not null

### Example statuses

- `queued`
- `running`
- `completed`
- `failed`

---

## 4.20 `tool_executions`

Tracks every tool call made through Sandra Gateway.

### Fields

- `id` UUID primary key
- `request_id` text not null
- `tool_name` text not null
- `user_id` UUID nullable
- `system_identity` text nullable
- `status` text not null
- `input_payload` jsonb nullable
- `output_payload` jsonb nullable
- `error_message` text nullable
- `executed_at` timestamp not null
- `duration_ms` integer nullable
- `metadata` jsonb nullable

### Example statuses

- `success`
- `failed`
- `blocked`
- `timeout`

---

## 4.21 `audit_logs`

Stores sensitive and operational audit events.

### Fields

- `id` UUID primary key
- `event_type` text not null
- `actor_type` text not null
- `actor_id` UUID nullable
- `target_type` text nullable
- `target_id` UUID nullable
- `description` text nullable
- `payload` jsonb nullable
- `created_at` timestamp not null

### Example actor types

- `user`
- `admin`
- `system`
- `connector`

---

## 4.22 `admin_actions`

Tracks admin-only operational actions.

### Fields

- `id` UUID primary key
- `admin_user_id` UUID foreign key
- `action_type` text not null
- `target_type` text nullable
- `target_id` UUID nullable
- `payload` jsonb nullable
- `created_at` timestamp not null

---

# 5. Firestore Data Model

Firestore is for realtime and client-facing conversational state.

## 5.1 `chat_sessions`

Represents active or archived chat sessions.

### Fields

- `sessionId`
- `userId` nullable
- `channel`
- `status`
- `language`
- `title` nullable
- `lastMessageAt`
- `createdAt`
- `updatedAt`
- `metadata`

### Example channel values

- `web`
- `whatsapp`
- `instagram`
- `email`
- `voice`

### Example status values

- `active`
- `closed`
- `archived`

---

## 5.2 `chat_sessions/{sessionId}/messages`

Stores chat messages in a session.

### Fields

- `messageId`
- `role`
- `content`
- `contentType`
- `senderType`
- `language`
- `timestamp`
- `status`
- `toolCalls` optional
- `metadata`

### Example roles

- `user`
- `assistant`
- `system`
- `tool`

### Example sender types

- `human`
- `sandra`
- `system`

---

## 5.3 `live_presence`

Tracks current channel presence or active session metadata.

### Fields

- `userId`
- `channel`
- `isOnline`
- `lastSeenAt`
- `metadata`

---

## 5.4 `notifications`

Stores app-facing notifications.

### Fields

- `notificationId`
- `userId`
- `type`
- `title`
- `body`
- `read`
- `createdAt`
- `metadata`

---

## 5.5 `channel_state`

Stores channel-specific conversational state if needed.

### Fields

- `channelStateId`
- `channel`
- `externalUserId`
- `sessionId`
- `state`
- `updatedAt`

### Examples

This can help manage WhatsApp or Instagram conversation continuity.

---

## 5.6 `temporary_conversation_state`

Stores ephemeral state used only for short-lived workflow continuity.

### Fields

- `stateId`
- `sessionId`
- `workflowType`
- `statePayload`
- `expiresAt`
- `createdAt`

---

# 6. Vector Knowledge Model

The vector layer stores semantic representations of content Sandra can retrieve.

## Knowledge Objects

Every indexed chunk should be associated with:

- `vector_id`
- `source_id`
- `document_key`
- `chunk_index`
- `content`
- `source_type`
- `initiative`
- `language`
- `tags`
- `last_indexed_at`

## Recommended Metadata Dimensions

- initiative name
- repo full name
- source path
- content type
- public or private visibility
- language
- tags
- version or checksum

## Initial Sources to Index

- repo READMEs
- docs folders
- public initiative pages
- FAQs
- course descriptions
- program descriptions
- policies

---

# 7. API Design Principles

Sandra should expose internal APIs through the Sandra Gateway.

## API Characteristics

- server-side only for sensitive operations
- input validation required
- output should be structured and typed
- permission checks required
- auditable for sensitive actions

## API Categories

### Public Data APIs
Examples:

- list initiatives
- get public course catalog
- get program information
- search indexed public knowledge

### User Data APIs
Examples:

- get own certificates
- get own enrollments
- get own application status
- get preferences

### Operational APIs
Examples:

- list repos
- trigger indexing
- get indexing status
- view system health

---

# 8. Standard API Envelope

All Sandra Gateway APIs should use a consistent response envelope.

## Success Response

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {
    "requestId": "req_123"
  }
}

Error Response

{
  "success": false,
  "data": null,
  "error": {
    "code": "FORBIDDEN",
    "message": "User is not authorized to access this resource."
  },
  "meta": {
    "requestId": "req_123"
  }
}


⸻

9. Core Internal API Contracts

9.1 POST /api/sandra/chat

Main entry point for chat.

Request

{
  "sessionId": "sess_123",
  "channel": "web",
  "message": "Show me my certificates",
  "language": "en",
  "metadata": {}
}

Response

{
  "success": true,
  "data": {
    "reply": "You currently have 3 certificates.",
    "sessionId": "sess_123",
    "messageId": "msg_456",
    "toolCalls": [
      {
        "tool": "getUserCertificates",
        "status": "success"
      }
    ]
  },
  "error": null,
  "meta": {
    "requestId": "req_789"
  }
}


⸻

9.2 GET /api/sandra/conversations/:sessionId

Returns session history.

Response

{
  "success": true,
  "data": {
    "sessionId": "sess_123",
    "messages": []
  },
  "error": null,
  "meta": {
    "requestId": "req_001"
  }
}


⸻

9.3 GET /api/sandra/repos

Lists registered repositories.

Response

{
  "success": true,
  "data": {
    "repos": []
  },
  "error": null,
  "meta": {
    "requestId": "req_002"
  }
}


⸻

9.4 POST /api/sandra/repos/:repoId/index

Triggers indexing for one repo.

Request

{
  "force": true
}

Response

{
  "success": true,
  "data": {
    "jobId": "job_123",
    "status": "queued"
  },
  "error": null,
  "meta": {
    "requestId": "req_003"
  }
}


⸻

9.5 GET /api/sandra/index-jobs/:jobId

Returns index job status.

Response

{
  "success": true,
  "data": {
    "jobId": "job_123",
    "status": "running"
  },
  "error": null,
  "meta": {
    "requestId": "req_004"
  }
}


⸻

9.6 GET /api/sandra/health

Basic health endpoint.

Response

{
  "success": true,
  "data": {
    "status": "ok",
    "services": {
      "firestore": "ok",
      "postgres": "ok",
      "vectorStore": "ok"
    }
  },
  "error": null,
  "meta": {
    "requestId": "req_005"
  }
}


⸻

10. Tool Contract Design

Sandra should use tools rather than arbitrary function calls.

Standard Tool Contract

Every tool should define:
	•	name
	•	description
	•	inputSchema
	•	requiredScopes
	•	executionMode
	•	handler

Example Tool Shape

type SandraTool<Input, Output> = {
  name: string;
  description: string;
  requiredScopes: string[];
  inputSchema: unknown;
  execute: (ctx: ToolContext, input: Input) => Promise<Output>;
};


⸻

11. Tool Context Contract

Every tool execution should receive a structured context.

ToolContext

Should contain:
	•	request ID
	•	user ID nullable
	•	system identity
	•	session ID
	•	channel
	•	language
	•	granted scopes
	•	logger
	•	connector access
	•	runtime metadata

Example

{
  "requestId": "req_123",
  "userId": "user_123",
  "sessionId": "sess_123",
  "channel": "web",
  "language": "en",
  "grantedScopes": [
    "read:own_certificates"
  ]
}


⸻

12. Example Tool Definitions

12.1 searchKnowledgeBase

Purpose

Search public indexed Sandra knowledge.

Required scopes
	•	read:public_content

Input

{
  "query": "What is EdLight Code?",
  "initiative": "code"
}

Output

{
  "results": [
    {
      "title": "EdLight Code README",
      "snippet": "EdLight Code is...",
      "sourceType": "github_readme"
    }
  ]
}


⸻

12.2 getEdLightInitiatives

Purpose

List active EdLight initiatives.

Required scopes
	•	read:public_content

Input

{}

Output

{
  "initiatives": [
    {
      "slug": "code",
      "name": "EdLight Code"
    }
  ]
}


⸻

12.3 lookupRepoInfo

Purpose

Return repository metadata.

Required scopes
	•	read:public_content

Input

{
  "repoFullName": "edlinitiative/code"
}

Output

{
  "name": "code",
  "repoUrl": "https://github.com/edlinitiative/code",
  "indexingEnabled": true
}


⸻

12.4 getUserCertificates

Purpose

Return current user certificates.

Required scopes
	•	read:own_certificates

Input

{
  "userId": "user_123"
}

Output

{
  "certificates": [
    {
      "courseTitle": "Python Basics",
      "issuedAt": "2026-03-10T00:00:00Z",
      "certificateUrl": "https://..."
    }
  ]
}


⸻

12.5 getUserEnrollments

Purpose

Return current user enrollments.

Required scopes
	•	read:own_courses

Input

{
  "userId": "user_123"
}

Output

{
  "enrollments": [
    {
      "courseTitle": "SQL Fundamentals",
      "status": "active",
      "progressPercent": 40
    }
  ]
}


⸻

12.6 getApplicationStatus

Purpose

Return a user’s program application status.

Required scopes
	•	read:own_application_status

Input

{
  "userId": "user_123",
  "programName": "ESLP"
}

Output

{
  "status": "under_review",
  "applicationCycle": "2026"
}


⸻

13. Permission Enforcement Rules

Every tool must check permissions before execution.

Permission Decision Inputs

The policy engine should evaluate:
	•	actor type
	•	authenticated user
	•	requested tool
	•	required scopes
	•	ownership
	•	channel
	•	initiative visibility
	•	admin overrides if applicable

Ownership Rule

For tools involving private data, Sandra must ensure the data belongs to the authenticated user unless an elevated admin permission exists.

Example:
A user should not be able to retrieve another user’s certificates.

⸻

14. Audit and Logging Rules

Sandra must log all important actions.

Must-Log Events
	•	every tool call
	•	every failed permission check
	•	every outbound communication action
	•	every indexing job
	•	every admin action
	•	every connector failure

Suggested Audit Events
	•	chat.request_received
	•	tool.execution_started
	•	tool.execution_succeeded
	•	tool.execution_failed
	•	permission.denied
	•	repo.indexing_started
	•	repo.indexing_completed
	•	connector.error
	•	admin.action_performed

⸻

15. Connector Contract Design

Each integration should implement a standard connector interface.

Connector Responsibilities
	•	authenticate
	•	validate scope
	•	fetch data
	•	perform allowed writes
	•	normalize output
	•	log failures

Suggested Connector Shape

type SandraConnector = {
  name: string;
  supportsRead: boolean;
  supportsWrite: boolean;
  getCapabilities: () => Promise<string[]>;
};

Example Connectors
	•	GitHubConnector
	•	EdLightCodeConnector
	•	EdLightAcademyConnector
	•	EdLightNewsConnector
	•	WhatsAppConnector
	•	EmailConnector

⸻

16. Channel Adapter Contract

Every channel adapter should normalize inbound and outbound interactions.

Inbound Normalization Contract

Each adapter should produce:
	•	channel
	•	externalUserId
	•	internalUserId nullable
	•	sessionId
	•	messageText
	•	language
	•	timestamp
	•	metadata

Outbound Response Contract

Each adapter should accept:
	•	normalized assistant reply
	•	optional rich content instructions
	•	metadata such as delivery target and channel state

⸻

17. Language and Personalization Model

Sandra should support:
	•	Haitian Creole
	•	French
	•	English

User Language Sources

Language preference may come from:
	•	explicit user setting
	•	recent session context
	•	channel-specific default
	•	runtime detection

Canonical Storage

Preferred language should be stored in users.preferred_language.

⸻

18. Suggested MVP Implementation Boundaries

To move quickly, the MVP should implement only the most important records first.

MVP Postgres Tables
	•	users
	•	user_identities
	•	roles
	•	user_roles
	•	permissions
	•	role_permissions
	•	initiatives
	•	repo_registry
	•	indexed_sources
	•	indexed_documents
	•	index_jobs
	•	tool_executions
	•	audit_logs

MVP Firestore Collections
	•	chat_sessions
	•	chat_sessions/{sessionId}/messages

MVP Tools
	•	searchKnowledgeBase
	•	getEdLightInitiatives
	•	lookupRepoInfo

Private user tools can come in phase two.

⸻

19. Long-Term Expansion

The data model should support future Sandra capabilities such as:
	•	personalized tutoring
	•	recommendation systems
	•	scholarship matching
	•	outreach automation
	•	admission workflows
	•	AI coaching
	•	voice-first learning

The current schema is intentionally modular so additional systems and tools can be added without redesigning the foundation.

⸻

20. Final Recommendation

Sandra should use:
	•	Firebase Auth for authentication
	•	Firestore for realtime conversational state
	•	Postgres for canonical structured data
	•	a vector store for semantic retrieval
	•	a strict tool contract system for all sensitive access

This model gives EdLight a strong foundation for building Sandra into a real AI platform rather than a simple chatbot.