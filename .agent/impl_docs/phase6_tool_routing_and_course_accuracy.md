# Phase 6: Tool Routing and Course Accuracy

## Goal
Improve Sandra's answers for EdLight Academy and EdLight Code questions so responses name actual courses when available instead of generic platform summaries.

## Problems observed
1. Sandra answers Academy course questions too generically.
2. Sandra routes some course questions to `getEdLightInitiatives` instead of a course/content lookup path.
3. Retrieval often returns 0 relevant results for course inventory questions.
4. Streaming tool-call bug was fixed, but answer quality is still weak.

## Required work

### A. Add course-aware retrieval/tooling
Implement a dedicated way to answer:
- what courses are on EdLight Academy
- what courses are on EdLight Code
- which course a beginner should start with

This may be a new tool or a major improvement to existing tool routing.

Requirements:
- detect target platform (`academy`, `code`, or both)
- return concrete course names/titles when present
- return links or paths when available
- prefer concrete catalog/course content over generic repo summaries

### B. Fix tool selection behavior
Update agent prompting/routing so:
- ecosystem overview questions use `getEdLightInitiatives`
- course inventory questions use course/content lookup
- platform-specific questions do not default to generic EdLight summaries

### C. Improve retrieval/indexing relevance
Improve retrieval for terms such as:
- course
- courses
- lesson
- module
- python
- sql
- excel
- powerpoint
- 3d
- academy
- code

Ensure README-only fallback does not dominate when better course-specific content exists.

### D. Response quality
When exact course data exists, Sandra should answer with concrete examples from indexed content.
When exact course data is unavailable, Sandra must say that clearly and avoid pretending.

### E. Tests
Add/update tests for:
- EdLight Academy course questions
- EdLight Code course questions
- beginner recommendation questions
- tool selection behavior
- fallback behavior when exact course inventory is unavailable

## Verification
Run:
- npm test
- npx tsc --noEmit
- npm run build

## Deliverable
Commit all code, tests, and prompt/tool changes on `feature/sandra-v2`.
