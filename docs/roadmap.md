# Sandra — Technical Implementation Roadmap

Organization: EdLight Initiative  
Project: Sandra  
Document Type: Technical Implementation Roadmap  
Status: Draft  
Version: 1.0  

---

# 1. Purpose

This roadmap defines the phased implementation plan for Sandra.

It translates the architecture and data model into an execution path that is realistic, modular, and scalable.

The roadmap is designed to help Sandra move from:

- concept
- to MVP
- to multi-channel assistant
- to secure user-aware platform
- to true AI agent layer for the EdLight ecosystem

This document focuses on:

- technical build order
- engineering priorities
- milestones
- deliverables
- dependencies
- what should be built now versus later

---

# 2. Guiding Principles

## 2.1 Build the Core Once

Sandra should not be built as separate bots for web, WhatsApp, Instagram, and voice.

The correct approach is:

- one core runtime
- one tool layer
- one data and permission model
- multiple channel adapters

---

## 2.2 Ship a Focused MVP First

The MVP should focus on:

- web chat
- public EdLight knowledge
- repo indexing
- clean architecture
- strong internal abstractions

The first version does not need to solve every integration.

---

## 2.3 Add Private Data Access Only After the Foundation Is Stable

Sandra should first be good at:

- answering public questions
- understanding the ecosystem
- retrieving documentation
- maintaining sessions

Only then should Sandra gain access to:

- enrollments
- certificates
- application status
- personalized workflows

---

## 2.4 Build for Extensibility

Every major system should be modular:

- channels
- tools
- connectors
- retrieval
- memory
- indexing
- permissions

Sandra should be easy to extend when EdLight launches new products.

---

# 3. Recommended Delivery Strategy

Sandra should be implemented in six major phases:

1. Foundation and Developer Infrastructure  
2. Core Sandra MVP  
3. Knowledge and Repo Learning  
4. Authenticated User Features  
5. Messaging and Multi-Channel Expansion  
6. Voice and Agentic Action Layer  

Each phase should leave the system usable and incrementally more powerful.

---

# 4. Phase 0 — Planning and Repository Setup

## Objective

Prepare the Sandra repo, documentation, architecture, and engineering conventions before implementation begins.

## Goals

- establish repo structure
- finalize technical direction
- create implementation docs
- define coding standards
- prepare environment and secrets model

## Deliverables

- `README.md`
- `docs/PRD.md`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/roadmap.md`
- `.env.example`
- base repo structure
- initial issue backlog

## Suggested Folder Structure

```text
sandra/
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

Exit Criteria
	•	architecture docs exist
	•	roadmap exists
	•	folder structure is defined
	•	core engineering choices are locked for MVP

⸻

5. Phase 1 — Foundation and Platform Setup

Objective

Build the core engineering foundation Sandra will rely on.

Goals
	•	set up the main app framework
	•	set up auth foundation
	•	set up database foundation
	•	set up shared types and config
	•	establish code quality and deployment basics

Recommended Stack
	•	Next.js
	•	TypeScript
	•	Tailwind CSS
	•	Firebase Auth
	•	Firestore
	•	Postgres
	•	Prisma
	•	vector layer abstraction
	•	Zod validation

Workstreams

5.1 Frontend and App Shell

Build:
	•	base Next.js app
	•	routing
	•	layout
	•	Tailwind setup
	•	base UI components

5.2 Shared Config and Environment

Build:
	•	config loader
	•	environment validation
	•	runtime-safe config module
	•	.env.example

5.3 Database Layer

Build:
	•	Prisma setup
	•	Postgres connection
	•	initial schema
	•	Firestore client setup
	•	migration flow

5.4 Auth Foundation

Build:
	•	Firebase Auth integration
	•	token verification on backend
	•	canonical user resolution flow
	•	user session helpers

5.5 Shared Types and Validation

Build:
	•	normalized request types
	•	response envelope types
	•	channel enums
	•	language enums
	•	permission enums
	•	tool contract types
	•	Zod schemas

5.6 Developer Quality

Set up:
	•	linting
	•	formatting
	•	TypeScript strict mode
	•	basic test setup
	•	logging foundation

Deliverables
	•	working app shell
	•	Firebase Auth connected
	•	Postgres connected
	•	Firestore connected
	•	Prisma schema initialized
	•	shared config and type packages
	•	developer setup instructions

Exit Criteria
	•	app boots successfully
	•	database connections work
	•	auth verification works
	•	shared config and schemas are in place

⸻

6. Phase 2 — Core Sandra MVP

Objective

Build the first working Sandra assistant for the web.

Goals
	•	create the Sandra runtime
	•	create the first web chat experience
	•	implement the tool layer foundation
	•	implement session and conversation flow
	•	enable public-question answering

Scope

This phase should only cover:
	•	web chat
	•	public knowledge
	•	no private user data tools yet
	•	no WhatsApp/Instagram/voice yet

Workstreams

6.1 Sandra Runtime

Build:
	•	request intake
	•	language handling
	•	session context loading
	•	retrieval hook
	•	tool orchestration hook
	•	response generation flow

6.2 Web Chat UI

Build:
	•	chat page
	•	chat input
	•	assistant response rendering
	•	loading states
	•	session persistence
	•	empty state and branding-ready UI

6.3 Message Persistence

Build:
	•	Firestore-backed session storage
	•	Firestore chat messages
	•	conversation history retrieval

6.4 Gateway API Foundation

Build:
	•	POST /api/sandra/chat
	•	GET /api/sandra/conversations/:sessionId
	•	standard success/error envelope
	•	input validation
	•	request IDs
	•	structured errors

6.5 Initial Tools

Implement:
	•	searchKnowledgeBase
	•	getEdLightInitiatives
	•	lookupRepoInfo

6.6 Language Support Foundation

Implement:
	•	Creole/French/English enums
	•	response language selection
	•	user language preference hook
	•	system prompt helpers for language behavior

Deliverables
	•	functional Sandra web chat
	•	messages stored in Firestore
	•	first working runtime loop
	•	first public tools working
	•	API routes available

Exit Criteria
	•	a user can open Sandra on web
	•	ask public questions about EdLight
	•	receive answers through the core runtime
	•	see message history in the same session

⸻

7. Phase 3 — Knowledge and Repo Learning

Objective

Teach Sandra the EdLight ecosystem through repo and documentation indexing.

Goals
	•	register EdLight repositories
	•	fetch README/docs content
	•	chunk and embed documents
	•	store vectorized knowledge
	•	retrieve relevant repo context at runtime

Initial Repositories
	•	EdLight Code
	•	EdLight News
	•	EdLight Initiative
	•	EdLight Academy

Workstreams

7.1 Repo Registry

Build:
	•	repo_registry table
	•	seed records for current repos
	•	repo management service

7.2 GitHub Connector

Build:
	•	repo metadata fetcher
	•	README fetcher
	•	docs path fetcher
	•	generic content loader
	•	GitHub auth support if needed

7.3 Indexing Pipeline

Build:
	•	source extraction
	•	text normalization
	•	chunking
	•	embedding generation
	•	vector storage abstraction
	•	indexed source metadata tracking

7.4 Retrieval Service

Build:
	•	semantic search over indexed knowledge
	•	ranking and filtering
	•	initiative-aware retrieval
	•	public/private visibility filtering

7.5 Admin and Ops Visibility

Build:
	•	repo listing page
	•	manual indexing trigger
	•	indexing status view
	•	indexed document count display

Deliverables
	•	current EdLight repos registered
	•	README/docs indexed
	•	Sandra can answer repo-aware questions
	•	admin can see indexing state

Exit Criteria
	•	Sandra answers ecosystem questions using retrieved repo content
	•	indexing can be triggered manually
	•	new repos can be added to the registry without code rewrites

⸻

8. Phase 4 — Memory and Personalization Layer

Objective

Give Sandra a more structured memory model and persistent user-aware context.

Goals
	•	distinguish session memory from long-term memory
	•	persist user preferences
	•	improve conversation continuity
	•	prepare for authenticated user features

Workstreams

8.1 Session Memory

Build:
	•	short-term conversation summarization strategy
	•	recent context retrieval
	•	context window management

8.2 User Memory Abstraction

Build:
	•	user preference storage
	•	preferred language
	•	initiative interests
	•	learning interests
	•	reusable personalization hooks

8.3 Memory Services

Build:
	•	memory save service
	•	memory retrieval service
	•	memory scoping rules
	•	user-linked memory resolution

8.4 Runtime Integration

Update Sandra Runtime to:
	•	load memory by user ID or session ID
	•	use memory carefully in prompts
	•	write back memory-worthy facts under explicit rules

Deliverables
	•	memory abstractions
	•	session context persistence improvements
	•	early personalization support

Exit Criteria
	•	Sandra remembers language preference
	•	Sandra can maintain better conversation continuity
	•	memory interfaces are stable enough for future expansion

⸻

9. Phase 5 — Authenticated User Features

Objective

Allow Sandra to securely answer user-specific questions.

Goals
	•	connect authenticated users to canonical records
	•	add private-data tools
	•	enforce permission checks
	•	log sensitive access

Workstreams

9.1 Canonical User Mapping

Build:
	•	Firebase UID to Postgres user mapping
	•	user provisioning flow
	•	user identity sync logic

9.2 Permission Engine

Build:
	•	role resolution
	•	scope resolution
	•	ownership checks
	•	tool execution authorization middleware

9.3 Private Data Models

Implement initial Postgres-backed domains for:
	•	users
	•	roles
	•	permissions
	•	enrollments
	•	certificates
	•	program applications
	•	consents

9.4 Private User Tools

Implement:
	•	getUserCertificates
	•	getUserEnrollments
	•	getApplicationStatus
	•	getUserProfileSummary

9.5 Audit Layer

Build:
	•	tool_executions
	•	audit_logs
	•	permission denial logs
	•	sensitive action event logging

Deliverables
	•	signed-in user resolution
	•	first secure private tools
	•	permissions enforced for every private tool
	•	audit logs working

Exit Criteria
	•	a signed-in user can ask Sandra for personal data
	•	Sandra only returns authorized records
	•	every sensitive action is logged

⸻

10. Phase 6 — Sandra Gateway Expansion

Objective

Expand the internal tool and connector ecosystem.

Goals
	•	make Sandra useful beyond answering questions
	•	connect more EdLight systems
	•	expose action-oriented tools
	•	normalize access through the gateway

Workstreams

10.1 Gateway Hardening

Improve:
	•	tool execution lifecycle
	•	retries where appropriate
	•	timeout handling
	•	structured error mapping
	•	request correlation

10.2 Connector Framework

Implement connector standards for:
	•	EdLight Code
	•	EdLight Academy
	•	EdLight News
	•	EdLight Initiative
	•	GitHub

10.3 Additional Tools

Examples:
	•	getCourseCatalog
	•	getLatestNews
	•	getProgramDeadlines
	•	searchScholarships
	•	getInitiativeLinks

10.4 Internal Admin Tools

Examples:
	•	triggerRepoIndexing
	•	getIndexingStatus
	•	listConnectedSystems
	•	viewSystemHealth

Deliverables
	•	stronger tool registry
	•	stronger connector architecture
	•	wider ecosystem support
	•	more operational visibility

Exit Criteria
	•	Sandra can act as a serious ecosystem interface
	•	new tools can be added without changing the runtime architecture

⸻

11. Phase 7 — WhatsApp Integration

Objective

Launch Sandra on WhatsApp using the same core runtime.

Goals
	•	add WhatsApp as a channel adapter
	•	support inbound and outbound messaging
	•	support user linking and session continuity
	•	keep web and WhatsApp behavior consistent

Workstreams

11.1 WhatsApp Adapter

Build:
	•	webhook handler
	•	inbound message normalization
	•	outbound message formatting
	•	delivery/error tracking

11.2 Session Linking

Build:
	•	external WhatsApp identity mapping
	•	session continuity rules
	•	phone-based user association logic

11.3 Tool Compatibility

Ensure the same runtime can serve WhatsApp requests with:
	•	public content tools
	•	authenticated tools where linked identity exists

Deliverables
	•	working WhatsApp Sandra
	•	shared runtime with web
	•	linked conversation flow

Exit Criteria
	•	a user can message Sandra on WhatsApp
	•	Sandra responds using the same core brain as web
	•	message history and identity linkage work as designed

⸻

12. Phase 8 — Email and Instagram Integration

Objective

Expand Sandra into additional communication channels.

Goals
	•	add email intake and response support
	•	add Instagram DM support
	•	normalize both into the same runtime

Workstreams

12.1 Email Adapter

Build:
	•	inbound email parser
	•	outbound email sender abstraction
	•	message threading logic
	•	permission-aware email operations

12.2 Instagram Adapter

Build:
	•	inbound DM handler
	•	outbound response formatting
	•	session state rules

12.3 Channel-Specific Formatting

Implement response formatting differences for:
	•	short chat channels
	•	email-style longer responses
	•	platform constraints

Deliverables
	•	Sandra on email
	•	Sandra on Instagram
	•	channel adapters integrated into the shared runtime

Exit Criteria
	•	Sandra supports at least 4 channels with one shared core architecture

⸻

13. Phase 9 — Voice Layer

Objective

Enable Sandra to communicate by voice.

Goals
	•	speech-to-text
	•	text-to-speech
	•	voice session handling
	•	voice-ready response shaping

Workstreams

13.1 Voice Input Pipeline

Build:
	•	audio upload or live stream handling
	•	transcription service integration
	•	transcription normalization

13.2 Voice Output Pipeline

Build:
	•	TTS service integration
	•	multilingual voice output support
	•	audio delivery format rules

13.3 Voice Conversation Runtime Adaptation

Update Sandra to:
	•	respond more naturally for spoken interactions
	•	manage shorter, clearer answers when in voice mode
	•	handle interruptions or reprompts later

Deliverables
	•	voice input support
	•	spoken response generation
	•	voice-aware runtime behavior

Exit Criteria
	•	a user can talk to Sandra and receive spoken replies

⸻

14. Phase 10 — Agentic Action Layer

Objective

Move Sandra from assistant to action-capable agent.

Goals
	•	support multi-step task execution
	•	perform safe actions across EdLight systems
	•	add workflows and automations
	•	maintain strict control and auditability

Workstreams

14.1 Action Tooling

Build tools such as:
	•	createLead
	•	queueReminder
	•	draftEmail
	•	sendMessage
	•	submitInterestForm
	•	recommendCourses

14.2 Workflow Engine

Build support for:
	•	multi-step tool sequences
	•	stateful workflows
	•	retries and checkpoints
	•	controlled autonomy boundaries

14.3 Human-in-the-Loop Controls

Implement:
	•	approval requirements for sensitive actions
	•	admin approval queues where needed
	•	safe-action boundaries

14.4 Operational Guardrails

Add:
	•	stronger policy rules
	•	action rate limiting
	•	anomaly logging
	•	action review tools

Deliverables
	•	first real agent workflows
	•	safe action-taking support
	•	human review path for risky operations

Exit Criteria
	•	Sandra can complete bounded multi-step tasks safely
	•	action workflows are auditable and permission-aware

⸻

15. Phase 11 — Advanced Intelligence and Optimization

Objective

Improve Sandra’s quality, speed, and usefulness over time.

Goals
	•	improve retrieval quality
	•	improve personalization
	•	improve response quality
	•	optimize cost and latency
	•	improve analytics and learning loops

Workstreams

15.1 Analytics

Track:
	•	question categories
	•	tool usage
	•	retrieval success
	•	response quality
	•	drop-off points
	•	channel usage
	•	language usage

15.2 Prompt and Tool Optimization

Improve:
	•	system prompts
	•	retrieval prompts
	•	tool selection logic
	•	fallback behavior

15.3 Recommendation Layer

Add:
	•	course recommendations
	•	initiative recommendations
	•	scholarship relevance scoring
	•	proactive educational guidance

15.4 Cost and Performance Optimization

Improve:
	•	caching
	•	retrieval efficiency
	•	model routing
	•	background processing strategy

Deliverables
	•	analytics dashboards
	•	improved response quality
	•	early recommendation features
	•	better system efficiency

Exit Criteria
	•	Sandra is measurably improving through operational feedback

⸻

16. Recommended Milestone Sequence

Milestone 1 — Repo and foundation

Complete:
	•	docs
	•	base repo
	•	config
	•	database setup
	•	auth setup

Milestone 2 — Sandra web MVP

Complete:
	•	runtime
	•	web chat
	•	Firestore messages
	•	public knowledge answers

Milestone 3 — Repo learning

Complete:
	•	repo registry
	•	GitHub ingestion
	•	indexing
	•	retrieval-backed answers

Milestone 4 — User-aware Sandra

Complete:
	•	canonical users
	•	permissions
	•	certificates/enrollments/application tools

Milestone 5 — Multi-channel Sandra

Complete:
	•	WhatsApp
	•	email
	•	Instagram

Milestone 6 — Voice and agent actions

Complete:
	•	voice
	•	controlled actions
	•	workflow support

⸻

17. Suggested Priority Order for Engineering

If engineering time is limited, build in this order:
	1.	architecture and docs
	2.	shared types and config
	3.	Postgres + Firestore + auth foundation
	4.	web chat UI
	5.	Sandra runtime
	6.	public tools
	7.	repo indexing and retrieval
	8.	admin indexing controls
	9.	canonical users and permissions
	10.	private tools
	11.	WhatsApp
	12.	email and Instagram
	13.	voice
	14.	action workflows

This order keeps Sandra useful early while protecting the long-term architecture.

⸻

18. Suggested MVP Definition

Sandra MVP should mean:
	•	web-based assistant
	•	multilingual support foundation
	•	answers public questions about EdLight
	•	understands indexed repo documentation
	•	stores chat sessions
	•	has clean runtime/tool/retrieval architecture
	•	includes admin repo indexing controls

Sandra MVP should not require:
	•	WhatsApp
	•	Instagram
	•	email
	•	voice
	•	advanced personalization
	•	autonomous workflows

Those come later.

⸻

19. Suggested Post-MVP Definition

Sandra post-MVP should include:
	•	authenticated user support
	•	certificates and enrollment retrieval
	•	permissions and audit logs
	•	stronger memory model
	•	WhatsApp support
	•	improved admin operations

⸻

20. Suggested Long-Term Definition

Sandra long-term platform should include:
	•	all major EdLight channels
	•	repo auto-learning
	•	user-aware guidance
	•	voice support
	•	tool-driven actions
	•	cross-initiative orchestration
	•	internal operational tooling
	•	strong observability and compliance controls

At that point Sandra becomes the AI operating layer of the EdLight ecosystem.

⸻

21. Risks by Phase

Early Risks
	•	overbuilding before MVP
	•	muddy architecture
	•	too many channel integrations too soon

Mid-Phase Risks
	•	poor permission design
	•	weak auditability
	•	inconsistent connector contracts

Late Risks
	•	unsafe autonomous actions
	•	scaling complexity
	•	fragmented system behavior across channels

⸻

22. Recommendation

The best way to build Sandra is:
	•	web first
	•	public knowledge first
	•	repo learning second
	•	authenticated private tools third
	•	messaging channels fourth
	•	voice fifth
	•	autonomous workflows last

This sequence is the best balance between:
	•	speed
	•	safety
	•	maintainability
	•	product value

⸻

23. Final Summary

Sandra should be built as a modular AI platform, not as a one-off chatbot.

The implementation roadmap should prioritize:
	•	one shared runtime
	•	one shared tool layer
	•	one consistent permission model
	•	one consistent knowledge pipeline
	•	multiple channel adapters over time

If implemented in this order, Sandra can grow from an MVP assistant into a true multi-system AI agent serving the full EdLight ecosystem.

⸻


