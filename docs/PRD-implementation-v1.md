# Sandra — Implementation PRD (Version 1)

> Historical implementation note: this document captures the original V1 build plan.
> Several API and status details here are now superseded by the validated release
> docs in `docs/releases/v2.md` and
> `docs/implementation/sandra-ai-platform/progress.md`.

Organization: EdLight Initiative  
Project: Sandra  
Document Type: Implementation Product Requirements Document  
Status: Active  
Version: 1.0  

---

# 1. Executive Summary

Sandra is the AI assistant for the EdLight ecosystem.

Sandra will act as the central conversational interface connecting EdLight platforms such as:

- EdLight Code
- EdLight Academy
- EdLight News
- EdLight Initiative

Users should be able to ask Sandra questions about these initiatives and receive responses generated using indexed knowledge from EdLight repositories and documentation.

This PRD defines the **Version 1 implementation** of Sandra.

Version 1 focuses on:

- web chat interface
- knowledge retrieval from EdLight repositories
- structured agent runtime
- tool-based architecture
- secure system foundation

This version **does not yet include messaging platforms or private user data access**.

---

# 2. Implementation Goal

The goal of Version 1 is to deliver a working Sandra assistant that can:

- run as a web-based chat interface
- answer questions about EdLight initiatives
- retrieve answers using indexed repository documentation
- maintain conversation sessions
- expose a structured runtime and tool architecture
- provide administrative indexing controls

Sandra Version 1 should be deployable and usable by end users through the web interface.

---

# 3. In Scope

The following features **must be implemented in Version 1**.

## Web Chat Interface
Users can open Sandra in a browser and interact through a chat UI.

## Public Knowledge Question Answering
Sandra can answer questions about:

- EdLight Code
- EdLight News
- EdLight Academy
- EdLight Initiative

using indexed repository content.

## Repository Indexing
Sandra must index the following repositories:

- https://github.com/edlinitiative/code
- https://github.com/edlinitiative/EdLight-News
- https://github.com/edlinitiative/EdLight-Initiative
- https://github.com/edlinitiative/EdLight-Academy

README and documentation files must be processed into a retrieval system.

## Sandra Agent Runtime
Sandra must operate through a centralized runtime that:

- receives normalized user requests
- retrieves relevant knowledge
- executes tools when necessary
- generates responses
- logs actions

## Tool-Based Architecture
Sandra must access system functionality through a tool registry rather than direct database access.

## Admin Indexing Controls
Admins must be able to:

- list indexed repositories
- trigger indexing manually
- view indexing status

## Multilingual Foundation
Sandra must support:

- Haitian Creole
- French
- English

---

# 4. Out of Scope

The following features **must NOT be implemented in Version 1**.

- WhatsApp integration
- Instagram messaging
- email sending
- voice interaction
- private user data access
- course enrollment retrieval
- certificate retrieval
- autonomous multi-step agent workflows
- advanced analytics dashboards
- cross-platform workflow automation

These features are planned for later versions.

---

# 5. Required Technology Stack

The implementation must use the following technologies.

Frontend:

- Next.js (App Router)
- TypeScript
- Tailwind CSS

Backend:

- Next.js server routes
- Node.js runtime

Authentication:

- Firebase Auth

Realtime State:

- Firestore

Structured Database:

- Postgres
- Prisma ORM

Validation:

- Zod

AI Integration:

- LLM provider abstraction layer

Knowledge Retrieval:

- vector store abstraction

---

# 6. Required Repository Structure

The repository must follow this structure.

apps/
web/
admin/

services/
agent-runtime/
gateway-api/
indexer/
workers/

packages/
auth/
channels/
tools/
connectors/
memory/
knowledge/
config/
shared-types/

docs/

Explanation:

apps/web  
Web chat interface.

apps/admin  
Internal admin UI.

services/agent-runtime  
Sandra runtime orchestration.

services/gateway-api  
Internal API exposing tools.

services/indexer  
Repository indexing pipeline.

services/workers  
Background jobs.

packages/auth  
Authentication helpers.

packages/channels  
Channel adapters.

packages/tools  
Tool registry and execution.

packages/connectors  
System integrations.

packages/memory  
Conversation memory.

packages/knowledge  
Retrieval logic.

packages/config  
Environment configuration.

packages/shared-types  
Shared TypeScript types.

---

# 7. Core User Stories

## User Story 1

As a visitor,  
I want to ask Sandra questions about EdLight initiatives  
so that I can learn about available programs.

### Acceptance Criteria

- user opens Sandra web chat
- user submits question
- Sandra generates answer
- answer uses indexed knowledge when relevant
- conversation history is stored

---

## User Story 2

As a visitor,  
I want Sandra to remember the conversation during the session  
so that I can ask follow-up questions.

### Acceptance Criteria

- session ID created for each conversation
- message history stored
- follow-up questions reference prior context

---

## User Story 3

As an administrator,  
I want to trigger repository indexing  
so that Sandra can learn new documentation.

### Acceptance Criteria

- admin can list registered repositories
- admin can trigger indexing
- indexing status is visible

---

# 8. Data Model (MVP)

## Postgres Tables

Required tables:

users  
initiatives  
repo_registry  
indexed_sources  
indexed_documents  
index_jobs  
tool_executions  
audit_logs  

---

## Firestore Collections

chat_sessions  

Subcollection:

chat_sessions/{sessionId}/messages

---

# 9. Tool Contracts (MVP)

Sandra must implement the following tools.

## searchKnowledgeBase

Description  
Search indexed knowledge.

Required scope  
read:public_content

Input

{
“query”: “What is EdLight Code?”
}

Output

{
“results”: []
}

---

## getEdLightInitiatives

Description  
Return list of initiatives.

Required scope  
read:public_content

Input

{}

Output

{
“initiatives”: []
}

---

## lookupRepoInfo

Description  
Return repository metadata.

Required scope  
read:public_content

Input

{
“repoFullName”: “edlinitiative/code”
}

Output

{
“name”: “”,
“repoUrl”: “”
}

---

## triggerRepoIndexing

Description  
Trigger indexing job.

Required scope  
admin:indexing

Input

{
“repoId”: “”
}

Output

{
“jobId”: “”
}

---

## getIndexingStatus

Description  
Return indexing job status.

Required scope  
admin:indexing

Input

{
“jobId”: “”
}

Output

{
“status”: “”
}

---

# 10. API Contracts

## POST /api/sandra/chat

Main chat endpoint.

Input

{
“sessionId”: “”,
“message”: “”,
“language”: “en”
}

Output

{
“reply”: “”,
“sessionId”: “”,
“messageId”: “”
}

---

## GET /api/sandra/conversations/:sessionId

Returns session messages.

---

## GET /api/sandra/repos

Lists registered repositories.

---

## POST /api/sandra/repos/:repoId/index

Triggers indexing job.

---

## GET /api/sandra/index-jobs/:jobId

Returns job status.

---

## GET /api/sandra/health

Health check endpoint.

---

# 11. Repository Indexing Requirements

The indexing system must:

1. fetch repository README files
2. fetch documentation files
3. extract text
4. chunk documents
5. generate embeddings
6. store vector references
7. track metadata in Postgres

Indexed content must be retrievable by the Sandra runtime.

---

# 12. Security Constraints

The implementation must enforce the following rules.

- Sandra runtime must not query raw databases directly
- all database access must go through services
- tool execution must enforce permission scopes
- tool calls must be logged
- admin actions must be logged
- environment secrets must never be exposed to client code

---

# 13. Implementation Milestones

The system must be implemented in this order.

1. repository structure and config
2. shared types and environment validation
3. Firebase Auth integration
4. Prisma/Postgres schema
5. Firestore chat persistence
6. Sandra runtime
7. tool registry
8. GitHub indexing pipeline
9. retrieval system
10. API routes
11. web chat UI
12. admin indexing interface
13. documentation

---

# 14. Deliverables

The following components must exist after implementation.

- working web chat assistant
- repository indexing pipeline
- retrieval-based responses
- tool registry system
- admin indexing controls
- Firebase authentication
- Firestore session storage
- Postgres database schema
- documented architecture

---

# 15. Future Versions

Future versions will include:

- authenticated user data tools
- WhatsApp integration
- Instagram integration
- email assistant
- voice interaction
- personalized learning guidance
- agent workflows

These features are intentionally excluded from Version 1.

---

# 16. Success Criteria

Sandra Version 1 will be considered successful when:

- users can chat with Sandra through the web interface
- Sandra answers questions about EdLight initiatives
- responses use indexed repository knowledge
- conversations persist during sessions
- admins can manage repository indexing
- the architecture supports future expansion
