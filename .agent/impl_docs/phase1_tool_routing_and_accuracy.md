# Phase 1: Tool Routing and Response Accuracy

## Goal
Improve Sandra’s accuracy for platform-specific questions.

## Priorities
- Route Academy/Code course questions to getCourseInventory
- Prevent getEdLightInitiatives from being used for course listings
- Make answers concrete and grounded
- If data is unavailable, say so clearly

## Validation
- Add benchmark prompts
- Add/update tests
- npm test
- npx tsc --noEmit
- npm run build
