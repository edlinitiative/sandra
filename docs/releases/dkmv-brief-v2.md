# DKMV Brief — Sandra V2

## Context

Sandra V1 already provides:

- Web chat assistant
- Multilingual responses
- Repository indexing
- Agent runtime
- Tool execution
- Streaming chat
- Passing test suite

## Goal

Deliver Sandra V2.

Focus areas:

- Answer accuracy
- Tool routing correctness
- Retrieval grounding
- Streaming stability

## Instructions

Use the following documents:

docs/roadmap.md → long-term vision  
docs/releases/v2.md → V2 scope  
docs/releases/v2_tasks.md → execution queue

Do not re-implement V1 phases unless needed for a regression fix.

## Development Loop

1. Identify highest-priority unfinished V2 task
2. Implement code changes
3. Add/update tests
4. Run validation:
   - npm test
   - npx tsc --noEmit
   - npm run build
5. Commit meaningful improvements

## Deliverable

Sandra V2 providing accurate platform-specific responses
for EdLight Academy, Code, News, and Initiative.
