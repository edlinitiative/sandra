Below is a copy-paste ready IMPLEMENTATION_GUIDELINES.md designed specifically to guide DKMV or any coding agent while implementing Sandra.

It tells the agent how to think, how to structure code, and what rules must never be violated, which dramatically improves AI-generated code quality.

You can place this file at:

docs/IMPLEMENTATION_GUIDELINES.md


⸻


# Sandra — Implementation Guidelines

Organization: EdLight Initiative  
Project: Sandra  
Document Type: Implementation Guidelines  
Purpose: Guide AI coding agents and developers implementing Sandra  
Status: Active  

---

# 1. Purpose

This document defines the engineering rules, architectural principles, and development guidelines that must be followed when implementing Sandra.

Sandra is not a simple chatbot.  
It is designed to become the **AI operating layer for the EdLight ecosystem**.

Therefore the implementation must prioritize:

- clean architecture
- extensibility
- security
- modular integrations
- maintainability

This document should be followed by both human developers and AI engineering systems such as DKMV.

---

# 2. Core Architectural Rules

## Rule 1 — One Sandra Brain

Sandra must have **one shared runtime**.

All channels must use the same runtime:

- web
- WhatsApp (future)
- Instagram (future)
- email (future)
- voice (future)

Channel adapters must normalize messages into a shared request format.

Do NOT create separate bots for each platform.

---

## Rule 2 — Tool-Based System Access

Sandra must never directly access raw databases or external systems.

All system interactions must happen through **tools**.

Example tools:

- searchKnowledgeBase
- getEdLightInitiatives
- lookupRepoInfo
- triggerRepoIndexing
- getIndexingStatus

Future tools may include:

- getUserCertificates
- getUserEnrollments
- sendWhatsappReply
- draftEmail

The Sandra runtime must call tools instead of executing arbitrary queries.

---

## Rule 3 — Gateway API Pattern

All tools must execute through a gateway service.

Architecture:

Sandra Runtime
↓
Tool Registry
↓
Gateway API
↓
Connectors / Services
↓
Databases or External Systems

Sandra runtime must never bypass the gateway layer.

---

## Rule 4 — Public vs Private Data Separation

Sandra must support two data modes.

### Public Knowledge

Examples:

- initiative descriptions
- course catalog
- repository documentation
- public news content

This data can be accessed without authentication.

### Private Data

Examples:

- user certificates
- enrollments
- program applications
- personal preferences

This data must require authentication and permission checks.

Sandra Version 1 must only support **public knowledge access**.

---

# 3. Coding Standards

## Language

All code must be written in:

- TypeScript
- strict mode enabled

Avoid using `any`.

Prefer explicit interfaces and typed contracts.

---

## Validation

All API inputs must be validated using:

- Zod schemas

Never trust raw request payloads.

---

## Error Handling

All services must return structured errors.

Use consistent error responses:

{
success: false,
error: {
code: “ERROR_CODE”,
message: “Human readable message”
}
}

Never expose raw stack traces to client responses.

---

## Logging

Important operations must be logged.

Examples:

- tool execution
- indexing jobs
- connector failures
- permission denials
- admin actions

Logs should include request IDs.

---

# 4. Sandra Runtime Design

Sandra runtime is the core orchestrator.

## Runtime Responsibilities

- accept normalized requests
- determine language
- retrieve conversation context
- retrieve knowledge context
- decide whether to use tools
- generate responses
- log actions
- store message history

---

## Runtime Flow

	1.	receive normalized request
	2.	validate session and identity
	3.	load conversation memory
	4.	retrieve relevant knowledge
	5.	decide tool usage
	6.	execute tools
	7.	generate response
	8.	store conversation history
	9.	return response

The runtime must remain **stateless between requests** except for session retrieval.

---

# 5. Knowledge Retrieval Design

Sandra must answer questions using retrieval rather than only relying on the LLM.

## Knowledge Sources

Initial sources:

- EdLight Code repository
- EdLight News repository
- EdLight Initiative repository
- EdLight Academy repository

---

## Indexing Pipeline

Indexing must follow this process:

1. fetch repository content
2. extract text
3. normalize text
4. split into chunks
5. generate embeddings
6. store embeddings
7. store metadata in Postgres

---

## Retrieval Flow

When answering a question:

1. detect need for retrieval
2. search vector index
3. select relevant chunks
4. provide context to model
5. generate response

Sandra should prefer retrieved knowledge when available.

---

# 6. Channel Adapter Design

Channels should not contain business logic.

Each adapter should only:

- receive messages
- normalize message format
- send responses

Adapters must convert messages into a shared request structure.

Example normalized request:

{
channel: “web”,
sessionId: “…”,
userId: “…”,
message: “…”,
language: “en”
}

---

# 7. Repository Indexing System

Sandra must maintain a registry of repositories.

The following repositories must be seeded:

- edlinitiative/code
- edlinitiative/EdLight-News
- edlinitiative/EdLight-Initiative
- edlinitiative/EdLight-Academy

Indexing must:

- fetch README files
- fetch documentation files
- chunk text
- embed chunks
- store metadata

Indexing must be triggerable through the admin interface.

---

# 8. Database Guidelines

Sandra uses a hybrid storage model.

## Firestore

Used for:

- chat sessions
- chat messages
- real-time conversation state

Collections:

- chat_sessions
- chat_sessions/{sessionId}/messages

---

## Postgres

Used for:

- canonical user records
- repo registry
- indexed sources
- indexed documents
- indexing jobs
- tool execution logs
- audit logs

Postgres is the source of truth for structured data.

---

# 9. Security Rules

Sandra must follow strict security rules.

### Rule 1
The LLM must never have direct database access.

### Rule 2
All system operations must go through tools.

### Rule 3
Tools must validate permissions.

### Rule 4
Secrets must never be exposed to the client.

### Rule 5
All sensitive operations must be logged.

---

# 10. Admin Capabilities

The admin interface must allow:

- viewing registered repositories
- triggering indexing jobs
- viewing indexing status
- viewing tool execution logs

Admin access must require authentication.

---

# 11. Performance Guidelines

Sandra should aim for:

- sub-3 second response time for common queries
- cached retrieval results where possible
- background indexing tasks
- efficient vector search

Long-running tasks must be executed in workers.

---

# 12. Code Organization Rules

Do not mix concerns.

Example rules:

Channel adapters must not contain AI logic.  
Runtime must not contain UI code.  
Tools must not directly access UI state.  
Connectors must not contain runtime orchestration.

Each module must have a clear responsibility.

---

# 13. Testing Guidelines

The following components should have tests:

- tool execution
- API validation
- runtime orchestration
- indexing pipeline
- retrieval logic

Tests should focus on behavior rather than internal implementation.

---

# 14. Documentation Requirements

All services must include documentation.

Minimum documentation:

- README
- architecture overview
- environment setup
- indexing instructions
- tool registry explanation

Documentation should live inside the `/docs` directory.

---

# 15. AI Coding Agent Behavior

AI coding agents implementing Sandra should:

- follow the architecture strictly
- avoid inventing unnecessary complexity
- implement only what the PRD specifies
- avoid adding new technologies not listed in the stack
- avoid changing repository structure without justification
- prioritize modular and maintainable code

Agents should stop and request clarification when architectural conflicts appear.

---

# 16. Final Implementation Philosophy

Sandra should be built as a **platform**, not a feature.

Design decisions should prioritize:

- extensibility
- security
- clear boundaries between systems
- strong abstractions
- predictable behavior

The Version 1 goal is not to build the full Sandra vision.

The goal is to build a **solid foundation** that allows Sandra to grow into a full AI platform for the EdLight ecosystem.




