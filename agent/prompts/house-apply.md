---
description: Implement an apply-ready house-style change with test-first slices, review loops, and final verification.
---

# house-apply

Implement a house-style change that is already in apply-ready state.

## Prerequisites

- A change must exist with `proposal.md`, `design.md`, `specs/`, `tasks.md`,
  and `plan.md` all present and complete.
- The plan must include test-first slices, review checkpoints, and final
  verification intent.

## Steps

1. **Load the skill if available.**
   Attempt to load `openspec-house-style`. If unavailable, proceed with the
   embedded guidance below.

2. **Confirm apply-ready state.**
   Run `openspec status --change "<name>" --json` and verify all five planning
   artifacts exist (`proposal`, `design`, `specs`, `tasks`, `plan`). If any
   are missing, stop and tell the user to run `/house-new` first.

3. **Read the plan.**
   Load `plan.md` and identify the ordered slices, review checkpoints,
   and final verification intent. Load `tasks.md` for the task list.

4. **Implement each slice test-first.**
   For each slice in plan order:

   a. Write or adjust the test first. Confirm it fails (red).
   b. Implement the production code. Confirm the test passes (green).
   c. If the plan records a TDD exception for this slice, proceed without
      the failing-test step and note the exception in the task log.
   d. Delegate every planned targeted check to the `runner` subagent after
      the slice (tests, lint, build — the narrowest check that gives
      meaningful evidence). Treat Runner `FAILED` and `BLOCKED` results as
      non-passing. Send fixes to the `fixer` subagent, never to Runner,
      then delegate the affected check to Runner again. Never advance a
      slice on a non-passing check.

5. **Run review at checkpoints.**
   At each review checkpoint defined in the plan, run the review loop via
   `/fix-loop` (fixer implements → oracle reviews → iterate until no
   blocking open findings). `/fix-loop` writes and updates `review.md` in
   the change directory. If `/fix-loop` is unavailable, use the global
   `/review` command or delegate a focused review to the `oracle` subagent.
   - Fix every actionable finding or explicitly disposition it.
   - Rerun review after fixes.
   - Do not advance until the review loop is clean — `review.md` verdict
     must be `PASSED`.

6. **Run final verification.**
   After the last review loop is clean (`review.md` verdict `PASSED`):
   - Delegate every command under "Final verification intent" from `plan.md`
     to the `runner` subagent.
   - Treat `FAILED` and `BLOCKED` as non-passing. Route fixes to the
     `fixer` subagent, repeat review until clean, and delegate affected
     checks to Runner again.
   - Create or update `verify.md`. For every planned check, record its type,
     exact command, exit code (or `NOT RUN`), and outcome.
   - Record an overall passing outcome only when every planned check passed.

7. **Mark tasks complete.**
   Update `tasks.md` checkboxes as tasks finish. All tasks must be checked
   before archive.

8. **Report result.**
   Tell the user the change is ready for `/house-archive`.

## Guardrails

- The orchestrator never writes or edits code directly — delegate all code
  writing and editing to the `fixer` subagent (or another write-capable
  specialist). Do not use `bash`/`sed`/`awk` to modify source files.
- Implement in plan order, one slice at a time. Do not jump ahead.
- Every behavioral task starts with a failing test unless the plan records an
  explicit TDD exception for it.
- A non-passing check never advances the workflow — fix and re-run.
- Keep code changes minimal and scoped to each task.
- If implementation reveals a design issue, pause and suggest updating the
  planning artifacts (`/house-new` on the same change or `openspec update`),
  do not silently deviate.
- Read context files from disk (`openspec instructions apply --change "<name>" --json`
  → `contextFiles`), re-reading them even if seen earlier — the user may have
  edited them.
- No `opsx-*` commands are used in this workflow.
