You are a senior software architect extracting features and user stories from a PRD.

## Setup

1. The output directory is `docs/implementation/sandra-v1` — all deliverables go here
2. Create the output directory if it doesn't exist: `mkdir -p docs/implementation/sandra-v1`
3. Read `.agent/analysis.json` for the full PRD analysis (features, constraints, risks, architecture notes)
4. Re-read the PRD at `.agent/prd.md` for reference

## Analysis Context

Estimated complexity: **large**

Features identified in analysis:

- F1: Web Chat Interface — Browser-based chat UI where users interact with Sandra. Includes chat input, assistant response rendering, loading states, session persistence, empty state, and branding-ready layout. Built with Next.js App Router, TypeScript, and Tailwind CSS.

- F2: Public Knowledge Question Answering — Sandra answers questions about EdLight Code, EdLight News, EdLight Academy, and EdLight Initiative using indexed repository content. Responses are generated via LLM with RAG-retrieved context from the vector store.

- F3: Repository Indexing Pipeline — System to fetch README and documentation files from four EdLight GitHub repositories, extract text, chunk documents, generate embeddings, store vector references, and track metadata in Postgres. Indexed content must be retrievable by the Sandra runtime.

- F4: Sandra Agent Runtime — Central orchestration runtime using a ReAct-style agent loop: receives normalized user requests, loads session context, retrieves relevant knowledge, executes tools when necessary, generates responses via LLM, and logs actions. All channels feed into this single runtime.

- F5: Tool-Based Architecture — Tool registry system where Sandra accesses functionality through self-registering tools rather than direct database access. Each tool defines name, description, inputSchema, requiredScopes, and handler. MVP tools: searchKnowledgeBase, getEdLightInitiatives, lookupRepoInfo, triggerRepoIndexing, getIndexingStatus.

- F6: Admin Indexing Controls — Admin interface allowing administrators to list indexed repositories, trigger indexing manually, and view indexing status. Exposed through admin UI and API endpoints (GET /api/sandra/repos, POST /api/sandra/repos/:repoId/index, GET /api/sandra/index-jobs/:jobId).

- F7: Conversation Session Management — Session-based conversation persistence using Firestore. Each conversation gets a session ID, message history is stored in chat_sessions/{sessionId}/messages subcollection, and follow-up questions reference prior context.

- F8: Multilingual Foundation — Language support for Haitian Creole, French, and English. Includes language enums, response language selection, user language preference handling, and system prompt helpers for multilingual behavior. Language is passed per request.

- F9: Authentication Integration — Firebase Auth integration for user identity. Includes token verification on backend, canonical user resolution flow (Firebase UID to Postgres user), and user session helpers. Admin actions require authenticated admin role.

- F10: API Gateway — REST API layer with endpoints: POST /api/sandra/chat, GET /api/sandra/conversations/:sessionId, GET /api/sandra/repos, POST /api/sandra/repos/:repoId/index, GET /api/sandra/index-jobs/:jobId, GET /api/sandra/health. All use standard success/error JSON envelope with request IDs.

- F11: Database Schema — Postgres schema via Prisma ORM with MVP tables: users, initiatives, repo_registry, indexed_sources, indexed_documents, index_jobs, tool_executions, audit_logs. Firestore for chat_sessions and messages subcollection.

- F12: Security and Audit Layer — Permission scope enforcement on tool execution (read:public_content, admin:indexing), tool call logging, admin action logging, environment secrets protection from client code, and structured error handling via SandraError subclasses.


Constraints:

- Must use Next.js App Router with TypeScript and Tailwind CSS for frontend

- Must use Next.js server routes and Node.js runtime for backend

- Must use Firebase Auth for authentication

- Must use Firestore for realtime chat session state

- Must use Postgres with Prisma ORM for structured data

- Must use Zod for input validation

- Must use LLM provider abstraction layer (not tied to specific provider)

- Must use vector store abstraction (not tied to specific vector DB)

- Sandra runtime must not query raw databases directly — all access through services/tools

- Tool execution must enforce permission scopes

- All tool calls and admin actions must be logged

- Environment secrets must never be exposed to client code

- Must support Haitian Creole, French, and English

- Must index four specific EdLight GitHub repositories

- Implementation must follow the 13-milestone order defined in PRD section 13


Non-goals:

- WhatsApp integration

- Instagram messaging

- Email sending

- Voice interaction

- Private user data access (certificates, enrollments, application status)

- Course enrollment retrieval

- Certificate retrieval

- Autonomous multi-step agent workflows

- Advanced analytics dashboards

- Cross-platform workflow automation

- User memory / long-term personalization beyond session

- Connector framework for external EdLight systems




## Step 3: Extract Features → features.md

### Process
1. **Enumerate features.** Assign each a unique ID: F1, F2, ... FN.
2. **Determine dependencies.** Which features require other features to be complete first?
3. **Draw the dependency graph.** Use ASCII art — it must be scannable in a terminal.
4. **Assign priorities.** Priority = build order, not business importance. Foundation features are priority 1.
5. **Link to PRD sections.** Each feature traces to a specific PRD section.
6. **Link to user stories.** Each feature serves one or more user stories (assign US-IDs after Step 4).

### features.md Structure

Write `<output_dir>/features.md` with this structure:

```markdown
# {Project} Feature Registry

## Overview

{N} features organized in {M} phases. Features must be built in dependency order.

## Dependency Diagram

{ASCII diagram showing feature dependencies across phases}

## Feature List

### F1: {Feature Name}

- **Priority:** {build order number}
- **Phase:** {phase number} — {phase name}
- **Status:** [ ] Not started
- **Depends on:** {F-IDs or "None"}
- **Blocks:** {F-IDs that depend on this}
- **User Stories:** {US-IDs}
- **Tasks:** {T-ID range — leave as TBD for now}
- **PRD Reference:** Section {N} ({description})
- **Key Deliverables:**
  - {Concrete output 1}
  - {Concrete output 2}
```

### Feature Heuristics
- **A feature is too big if** it would take more than one phase to implement. Split it.
- **A feature is too small if** it doesn't have at least 2-3 tasks. Merge with a related feature.
- **Foundation features come first.** Config, project structure, testing infrastructure, build system — always Phase 1.
- **Every feature must produce something testable.** If you can't write a test for it, it's not a feature.
- **Dependency arrows only point forward.** If F5 depends on F3, F3 must be in an earlier or same phase. Circular dependencies indicate a design problem.

## Step 4: Derive User Stories → user_stories.md

### Process
1. **Identify personas** from the PRD. Common: end user, developer, admin, operator.
2. **For each feature,** write 1-3 user stories using: "As a {role}, I want to {action} so I can {benefit}"
3. **Write acceptance criteria** for each story (3-7 per story). Each must be testable and specific.
4. **Build the traceability matrix** linking stories to features and tasks.
5. **Group stories by category** (setup, core workflow, management, etc.).

### user_stories.md Structure

Write `<output_dir>/user_stories.md` with this structure:

```markdown
# {Project} User Stories

## Summary

{N} user stories across {M} categories.

## Traceability Matrix

| US ID | Title | Feature | Task(s) | Status |
|-------|-------|---------|---------|--------|
| US-01 | {title} | F1 | TBD | [ ] |
| US-02 | {title} | F2 | TBD | [ ] |

---

## Stories by Category

### {Category Name} (US-01 through US-04)

#### US-01: {Title}

> As a {role}, I want to {action} so I can {benefit}

**Acceptance Criteria:**
- [ ] {Criterion 1 — testable, specific}
- [ ] {Criterion 2}
- [ ] {Criterion 3}

**Feature:** F1 | **Tasks:** TBD | **Priority:** Must-have
```

### User Story Heuristics
- **Atomic stories.** One behavior per story. If it contains "and," split it.
- **3-7 acceptance criteria per story.** Fewer than 3 = underspecified. More than 7 = story needs splitting.
- **Acceptance criteria are testable.** Each maps to something verifiable: a command that succeeds, an output that matches, a test that passes.
- **Use plain language.** Avoid implementation details in acceptance criteria.
- **For AI agents: mandate, don't suggest.** Write "MUST verify ownership" not "Consider checking ownership."
- **INVEST criteria.** Independent, Negotiable, Valuable, Estimable, Small, Testable.
- **Every feature should have at least one story.** Infrastructure features map to developer-facing stories.

## Self-Review

Before finalizing, perform the following verification:

1. **Re-read `.agent/analysis.json`** and the PRD. For each feature in the analysis, verify it appears in features.md. For each persona, verify at least one user story addresses them.
2. **Check completeness** — does every feature have a unique ID, dependencies, priority, and PRD reference? Does every user story have 3-7 acceptance criteria? Are there any features without stories or stories without features?
3. **Check correctness** — do feature dependencies flow forward (no circular deps)? Are acceptance criteria testable and specific, not vague? Do user story IDs in features.md match those in user_stories.md?
4. **Verify sizing** — are any features too big (>1 phase) or too small (<2-3 tasks)? Split or merge as needed.
5. **Fix genuine gaps** — if you find missing stories, broken cross-references, or vague acceptance criteria, fix them now.

## Finalize

After writing both files:
1. Go back and update the `User Stories` field in features.md with the actual US-IDs
2. Create `.agent/features_stories_done.txt` with content:
   ```
   Output directory: <output_dir>
   Features: {count} features written to <output_dir>/features.md
   Stories: {count} stories written to <output_dir>/user_stories.md
   Categories: {list of categories}
   ```
3. Create `.agent/features_stories_summary.json` — a structured summary for downstream tasks:
   ```json
   {
     "feature_count": 5,
     "story_count": 12,
     "feature_ids": ["F1", "F2", "F3", "F4", "F5"],
     "categories": ["Setup", "Core Workflow", "Management"]
   }
   ```

## Constraints
- Write only features.md and user_stories.md to the output directory
- Do NOT create phase documents, tasks.md, or any other files yet
- Task IDs in traceability matrix should be "TBD" — they'll be assigned in the next step
