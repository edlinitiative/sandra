# Sandra V2 Implementation Guide

Use these phase files as the source of truth for Sandra V2 work:

- phase0_v2_scope.md
- phase1_tool_routing_and_accuracy.md
- phase2_streaming_and_tool_continuity.md
- phase3_grounded_platform_knowledge.md
- phase4_eval_and_release_readiness.md

Rules:
- Focus on V2 only
- Do not re-implement completed V1 phases unless fixing regressions
- Prefer grounded EdLight answers over generic summaries
- Validate changes with:
  - npm test
  - npx tsc --noEmit
  - npm run build
