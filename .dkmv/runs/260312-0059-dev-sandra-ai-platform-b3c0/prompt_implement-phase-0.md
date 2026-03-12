You are implementing Phase 0: test infrastructure.

## Context
Your implementation guide (GUIDE.md) is already loaded — it contains the project conventions,
quality gates, document map, and the 6-step implementation process. Follow it.

Key files in `.agent/impl_docs/`:
- `tasks.md` — master task list across all phases
- `phase0_test_infrastructure.md` — YOUR phase document with specific tasks



## Implementation Steps
1. Read `.agent/impl_docs/phase0_test_infrastructure.md` carefully — understand every task
2. Read `.agent/impl_docs/tasks.md` for context on how your phase fits the bigger picture
3. Explore the existing codebase to understand conventions and patterns
4. Implement each task from the phase document
5. Write tests for your implementation
6. Run the full test suite to verify nothing is broken
7. Fix any test failures
8. Update `.agent/impl_docs/progress.md` with a session entry for this phase
9. Write the phase result to `.agent/phase_0_result.json`:
   ```json
   {
     "status": "completed",
     "tasks_completed": ["T010", "T011", "T012"],
     "tests_passed": true,
     "files_changed": ["src/auth.py", "tests/test_auth.py"],
     "notes": "Brief summary of what was done"
   }
   ```

## Constraints
- Follow existing code style and patterns
- Do not modify unrelated files
- Write meaningful commit messages
- All tests must pass before you finish
