# Sandra — Product Requirements Document (PRD)

> Planning note: this file is the long-range product vision. It is not the best source
> for current delivery status or current API/runtime behavior. For the active release,
> use `docs/releases/v2.md` and
> `docs/implementation/sandra-ai-platform/progress.md`.

Product: Sandra  
Organization: EdLight Initiative  
Type: AI Agent Platform  
Status: Draft  
Version: 1.0  

---

# 1. Product Overview

Sandra is an AI-powered conversational agent designed to serve as the central interface for the EdLight ecosystem.

Sandra allows users to interact with EdLight platforms through natural conversation rather than navigating multiple websites or applications.

Users will be able to communicate with Sandra through:

- Web chat
- WhatsApp
- Instagram
- Email
- Voice interactions

Sandra supports:

- Haitian Creole
- French
- English

Sandra’s long-term purpose is to function as the **AI infrastructure layer for EdLight**, connecting all initiatives and simplifying user access to educational tools, programs, and resources.

---

# 2. Vision

Sandra will become the **primary gateway to the EdLight ecosystem**.

Instead of navigating multiple platforms, users will ask Sandra questions such as:

- How can I learn coding?
- What scholarships are available?
- How do I apply to the EdLight Summer Leadership Program?
- What news should I know today?

Sandra will retrieve the relevant information and guide users to the appropriate EdLight service.

---

# 3. Product Goals

## Primary Goals

- Provide a unified interface for all EdLight platforms
- Increase accessibility to educational tools
- Support conversational interaction in Creole, French, and English
- Enable communication through messaging platforms widely used in Haiti
- Reduce friction for users accessing EdLight services

---

## Long-Term Goals

Sandra will eventually support:

- AI tutoring
- personalized learning paths
- scholarship discovery
- AI mentorship
- voice-based education tools
- low-bandwidth learning environments

---

# 4. Target Users

## Primary Users

Students and young professionals in Haiti seeking:

- educational resources
- coding skills
- scholarships
- leadership programs
- global opportunities

---

## Secondary Users

- educators
- EdLight program participants
- volunteers
- donors
- international partners

---

# 5. Supported Platforms

Sandra will be accessible through multiple communication channels.

## Web

Embedded assistant on:

- EdLight Code
- EdLight Academy
- EdLight News
- EdLight Initiative websites

---

## Messaging Platforms

- WhatsApp
- Instagram
- Email

---

## Voice Interaction

- voice messages
- voice responses
- phone conversations (future)

Voice interaction is important for accessibility in environments where literacy may be limited.

---

# 6. Core Features

## Conversational AI

Sandra will support natural conversation in:

- Haitian Creole
- French
- English

Capabilities include:

- answering questions
- explaining concepts
- guiding users to services
- summarizing information

---

## Ecosystem Navigation

Sandra acts as a navigation layer for EdLight services.

Example:

User:  
How can I learn coding?

Sandra:  
Recommends EdLight Code and suggests beginner courses.

---

## Messaging Integration

Sandra will interact with users through messaging platforms.

### WhatsApp

Features:

- automated responses
- voice message support
- conversational interactions

---

### Instagram

Sandra responds to:

- direct messages
- program inquiries
- platform questions

---

### Email

Sandra assists with:

- answering inquiries
- providing program details
- directing users to resources

---

# 7. EdLight Ecosystem Integration

Sandra connects multiple EdLight platforms.

Current repositories include:

- https://github.com/edlinitiative/code
- https://github.com/edlinitiative/EdLight-News
- https://github.com/edlinitiative/EdLight-Initiative
- https://github.com/edlinitiative/EdLight-Academy

Sandra retrieves information from these platforms and guides users accordingly.

---

# 8. Automatic Ecosystem Expansion

Sandra will automatically expand as the EdLight ecosystem grows.

When new repositories are added to the EdLight GitHub organization:

1. Sandra scans the repository
2. README and documentation are indexed
3. APIs are detected and connected
4. The initiative becomes part of Sandra’s knowledge base

This allows Sandra to evolve alongside EdLight.

---

# 9. Example User Journeys

## Learning Coding

User asks how to learn coding.

Sandra recommends courses from EdLight Code and provides guidance.

---

## Scholarship Discovery

User asks about scholarships.

Sandra retrieves scholarship information and summarizes opportunities.

---

## Leadership Program Application

User asks about ESLP.

Sandra explains the program and directs the user to the application page.

---

# 10. Success Metrics

Key metrics include:

- number of users interacting with Sandra
- course enrollments driven by Sandra
- program applications initiated
- daily active conversations
- response accuracy

---

# 11. Non-Functional Requirements

## Scalability

Sandra must support thousands of simultaneous users.

---

## Multilingual Support

The system must support:

- Haitian Creole
- French
- English

---

## Low-Bandwidth Accessibility

Sandra should function effectively in low-connectivity environments.

---

# 12. Technical Architecture

Sandra will use a modular architecture composed of several layers.

---

## Interface Layer

Handles user interaction.

Components:

- web chat widget
- WhatsApp bot
- Instagram messaging integration
- email assistant
- voice interface

---

## Agent Layer

The AI reasoning engine responsible for:

- understanding user intent
- selecting tools
- generating responses
- managing conversations

---

## Knowledge Layer

Sandra maintains a knowledge base containing:

- EdLight documentation
- educational resources
- platform data
- indexed repository content

---

## Integration Layer

Connects Sandra to EdLight platforms via APIs.

Examples:

- EdLight Code course catalog
- EdLight Academy content
- EdLight News articles
- program application systems

---

## Communication Layer

Handles integrations with external services.

Examples:

- WhatsApp Business API
- Instagram messaging APIs
- email systems
- voice communication providers

---

# 13. Sandra Agent System Design

Sandra operates as an **agentic AI system**.

This means Sandra can perform actions rather than simply answering questions.

---

## Agent Components

### LLM Engine

Responsible for:

- natural language understanding
- reasoning
- response generation

---

### Tool System

Sandra can use tools to perform actions.

Examples:

- search EdLight repositories
- retrieve course data
- send messages
- summarize news
- enroll users in courses

---

### Memory System

Sandra maintains conversation context.

Types of memory:

Short-term memory

- active conversation context

Long-term memory

- user preferences
- learning history
- program interests

---

### Orchestration Engine

Controls the reasoning loop.

Steps include:

1. interpret user request
2. decide which tools to use
3. retrieve information
4. generate response

---

# 14. Infrastructure

Sandra requires several infrastructure components.

---

## AI Model

Language model used for:

- conversation
- reasoning
- summarization

Possible providers:

- OpenAI
- Anthropic
- Google

---

## Backend Server

Handles:

- API routing
- conversation management
- integrations

---

## Database

Stores:

- user conversations
- memory
- logs
- usage metrics

---

## Knowledge Index

Vector database used to index:

- documentation
- repository content
- educational materials

---

# 15. Security and Privacy

Sandra must protect user data.

Requirements include:

- secure storage of user conversations
- encryption of communication channels
- access control for integrations

---

# 16. Development Roadmap

## Phase 1 — MVP

Features:

- web chat assistant
- EdLight documentation retrieval
- multilingual conversation

---

## Phase 2 — Platform Integration

Features:

- EdLight Code integration
- EdLight News integration
- repository indexing

---

## Phase 3 — Messaging Integrations

Features:

- WhatsApp integration
- Instagram messaging support
- email assistant

---

## Phase 4 — Voice Interaction

Features:

- speech recognition
- text-to-speech
- phone-based conversations

---

# 17. Risks and Challenges

Key risks include:

- Haitian Creole language processing limitations
- integration complexity
- AI infrastructure costs
- maintaining response quality

---

# 18. Long-Term Vision

Sandra will become the **AI operating layer of the EdLight ecosystem**.

Eventually Sandra will:

- guide students through learning journeys
- deliver personalized educational content
- assist program applicants
- provide AI mentorship
- support voice-first education systems

Sandra will help scale EdLight’s mission of expanding access to education and leadership opportunities globally.
