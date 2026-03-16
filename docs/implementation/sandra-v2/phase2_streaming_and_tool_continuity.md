# Phase 2: Streaming and Tool Continuity

## Goal
Fix streaming behavior after tool calls.

## Priorities
- Preserve assistant tool_calls before tool messages
- Ensure follow-up model call includes valid assistant tool_calls message
- Eliminate tool-call continuity errors in /api/chat/stream
- Verify streaming answers render after tool execution

## Validation
- Reproduce with real prompts
- Add regression tests
- npm test
- npx tsc --noEmit
- npm run build
