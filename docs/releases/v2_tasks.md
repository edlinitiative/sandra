# Sandra V2 Tasks

## Priority 1 — Knowledge Accuracy

Improve Sandra's answers for EdLight ecosystem questions.

Tasks:
- Improve repository retrieval relevance
- Prioritize platform-specific content over generic summaries
- Ensure course information is extracted when available
- Ensure answers reference correct EdLight platforms

## Priority 2 — Tool Routing

Improve tool selection behavior.

Tasks:
- Prevent course questions from routing to getEdLightInitiatives
- Route Academy course questions to knowledge search
- Route Code course questions to knowledge search
- Use initiative tool only for ecosystem overview questions

Potential tools:
- getAcademyCourses
- getCodeCourses
- getLatestNews
- getInitiativePrograms

## Priority 3 — Retrieval Quality

Improve repository indexing and retrieval.

Tasks:
- Improve chunking relevance
- Improve search scoring
- Ensure docs folders are indexed
- Ensure course-related files rank higher

## Priority 4 — Streaming Stability

Improve streaming chat tool-call behavior.

Tasks:
- Preserve assistant tool_calls before tool messages
- Ensure tool results are injected correctly
- Prevent streaming tool state errors

## Priority 5 — Evaluation

Add benchmark prompts.

Examples:

- "What is EdLight?"
- "What courses can I find on EdLight Academy?"
- "What courses exist on EdLight Code?"
- "What does EdLight Initiative do?"

Sandra responses must be grounded in repository knowledge.

## Validation

Before committing:

npm test
npx tsc --noEmit
npm run build
