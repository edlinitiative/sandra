# Phase 4: Evaluation and Release Readiness

## Goal
Prepare Sandra V2 for stable use.

## Priorities
- Freeze the canonical V2 contracts
- Run benchmark prompts with grounded-answer expectations
- Verify routing, grounding, and streaming/session continuity
- Run operator QA for admin and indexing flows
- Verify build, typecheck, and tests
- Update legacy docs that drift from the release truth

## Canonical Reference

Use `docs/releases/v2_signoff.md` as the active release checklist and contract summary.

## Required Benchmark Set

- What is EdLight?
- What courses are on EdLight Academy?
- What courses exist on EdLight Code?
- What does EdLight Initiative do?
- What is EdLight News?
- What happens when indexed data is unavailable?

## Required Operator QA

- Admin API key entry and invalid-key handling
- Repo list integrity and sync-state visibility
- Single-repo indexing
- Index-all behavior
- Partial indexing failure surfacing
- Streaming response completion and session reload continuity

## Validation
- npm test
- npx tsc --noEmit
- npm run build
