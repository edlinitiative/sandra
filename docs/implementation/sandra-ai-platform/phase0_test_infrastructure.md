# Phase 0: Test Infrastructure

## Prerequisites

- Node.js and npm available
- Project dependencies installed (`npm install`)
- TypeScript compiles cleanly (`npx tsc --noEmit`)

## Phase Goal

A working test framework is in place so that all subsequent phases can include unit and integration tests alongside implementation.

## Phase Evaluation Criteria

- `npx vitest run` executes and exits cleanly (0 tests is OK)
- `npx vitest run src/lib/__tests__/setup.test.ts` passes a smoke test
- `npm run test` script exists in package.json and invokes Vitest
- `npx tsc --noEmit` passes with no errors
- `npx next lint` passes with no errors

---

## Tasks

### T001: Install and Configure Vitest

**PRD Reference:** N/A (infrastructure)
**Depends on:** Nothing
**Blocks:** T002, T003
**User Stories:** N/A (infrastructure)
**Estimated scope:** 30 min

#### Description

Install Vitest as the test runner with necessary configuration for a Next.js 15 + TypeScript project. Vitest is chosen over Jest for native ESM support and faster execution.

#### Acceptance Criteria

- [ ] `vitest` and `@vitejs/plugin-react` are in devDependencies
- [ ] `vitest.config.ts` exists at project root with path aliases matching `tsconfig.json`
- [ ] Configuration sets `globals: true` and `environment: 'node'` as defaults
- [ ] `npx vitest run` executes without errors

#### Files to Create/Modify

- `vitest.config.ts` — (create) Vitest configuration
- `package.json` — (modify) add vitest and related devDependencies

#### Implementation Notes

- Use `defineConfig` from `vitest/config`
- Set `resolve.alias` to match the `@/` path alias in `tsconfig.json` (maps to `./src/`)
- Set `test.include` to `['src/**/*.test.ts', 'src/**/*.test.tsx']`
- Do NOT add React testing library yet — that comes with Phase 4 UI tasks

#### Evaluation Checklist

- [ ] `npx vitest run` exits with code 0
- [ ] `vitest.config.ts` exists and is valid TypeScript

---

### T002: Create Test Utilities and Mock Helpers

**PRD Reference:** N/A (infrastructure)
**Depends on:** T001
**Blocks:** All test tasks in subsequent phases
**User Stories:** N/A (infrastructure)
**Estimated scope:** 30 min

#### Description

Create shared test utilities: a Prisma client mock, an AIProvider mock, and common test fixtures. These will be used across all phases.

#### Acceptance Criteria

- [ ] `src/lib/__tests__/mocks/prisma.ts` exports a mock Prisma client
- [ ] `src/lib/__tests__/mocks/ai-provider.ts` exports a mock AIProvider
- [ ] `src/lib/__tests__/helpers.ts` exports common test utilities (e.g., `createTestSession`, `createTestMessage`)
- [ ] `src/lib/__tests__/setup.test.ts` contains a passing smoke test

#### Files to Create/Modify

- `src/lib/__tests__/mocks/prisma.ts` — (create) mock Prisma client using `vi.fn()`
- `src/lib/__tests__/mocks/ai-provider.ts` — (create) mock AIProvider implementation
- `src/lib/__tests__/helpers.ts` — (create) test fixture factories
- `src/lib/__tests__/setup.test.ts` — (create) smoke test that imports mocks and asserts they exist

#### Implementation Notes

- Mock Prisma client: create an object with `vi.fn()` stubs for each model method used (session.create, session.findUnique, message.create, message.findMany, etc.)
- Mock AIProvider: implement the `AIProvider` interface from `src/lib/ai/types.ts` with `vi.fn()` stubs that return canned responses
- Test helpers: factory functions that return valid test objects (Session, Message, etc.) with sensible defaults and optional overrides
- Import types from `@prisma/client` and `src/lib/ai/types.ts`

#### Evaluation Checklist

- [ ] `npx vitest run src/lib/__tests__/setup.test.ts` passes
- [ ] Mock files are importable without errors

---

### T003: Add Test Scripts to Package.json

**PRD Reference:** N/A (infrastructure)
**Depends on:** T001
**Blocks:** Nothing
**User Stories:** N/A (infrastructure)
**Estimated scope:** 15 min

#### Description

Add npm scripts for running tests in various modes: single run, watch mode, and coverage.

#### Acceptance Criteria

- [ ] `npm run test` runs `vitest run`
- [ ] `npm run test:watch` runs `vitest` in watch mode
- [ ] `npm run test:coverage` runs `vitest run --coverage`
- [ ] All three scripts execute without errors

#### Files to Create/Modify

- `package.json` — (modify) add `test`, `test:watch`, `test:coverage` scripts

#### Implementation Notes

- Scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`
- Coverage provider can use `v8` (built-in, no extra dependency needed)

#### Evaluation Checklist

- [ ] `npm run test` exits cleanly
- [ ] `npm run test:watch` starts and can be interrupted with Ctrl+C
