# Phase 6 — Tool Routing and Content Accuracy

## Goal
Improve Sandra's answer quality for questions about EdLight Academy and EdLight Code courses.

## Problems observed
1. Sandra gives generic answers like "EdLight Academy offers structured courses and tutorials" instead of naming actual courses.
2. Sandra sometimes routes to `getEdLightInitiatives` when the question is about concrete course inventory.
3. Retrieval often returns 0 relevant results for course questions.
4. Streaming tool-call flow was fixed, but content accuracy is still weak.

## Required changes

### 1. Add a dedicated courses/content discovery tool
Implement a tool specifically for course discovery across EdLight Academy and EdLight Code.
The tool should:
- identify platform (`academy`, `code`, or both)
- return concrete course names/titles when available
- return links/slugs if available
- avoid generic ecosystem summaries unless no course data exists

### 2. Improve tool selection rules in Sandra prompts
Update agent prompting so that:
- questions like "what courses are on EdLight Academy?" prefer course discovery / knowledge search
- `getEdLightInitiatives` is used for ecosystem overview only
- platform-specific catalog questions do not default to initiative summaries

### 3. Improve repository retrieval for course pages
Strengthen retrieval/indexing so course-related files are easier to find:
- prioritize course/catalog files
- improve matching on terms like course, lesson, module, python, sql, excel, academy, code
- ensure README-only fallback does not dominate answers when more specific content exists

### 4. Response quality requirement
When course data exists, Sandra should answer with concrete examples such as:
- Python
- SQL
- Microsoft Excel
- PowerPoint
- 3D modeling / 3D printing
or whatever is actually present in indexed content

If exact inventory is unavailable, Sandra must say so clearly and avoid pretending.

### 5. Tests
Add or update tests for:
- tool selection on Academy course questions
- tool selection on Code course questions
- non-generic answers when indexed course content exists
- fallback behavior when only high-level platform data exists

## Verification
Run:
- npm test
- npx tsc --noEmit
- npm run build

## Deliverable
Commit all code, test, and prompt changes on `feature/sandra-v2`.
