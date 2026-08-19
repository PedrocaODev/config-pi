---
name: openspec-house-style
description: Global house-style workflow pack for OpenSpec and Pi. Use when the user invokes any house-* command or explicitly asks for the house-style workflow.
---

# openspec-house-style

Global house-style workflow pack for OpenSpec and Pi. The lifecycle is
`grill → house-new → house-apply → house-archive`. No `opsx-*` commands are
part of this workflow.

## When to load

Load this skill when the user invokes any `house-*` command (`house-init`,
`house-new`, `house-apply`, `house-archive`) or explicitly asks for the
house-style workflow. The skill provides the shared rules the commands rely
on; if loading fails, the commands contain enough embedded guidance to
operate as a fallback.

## Core rules

### Project bootstrap

- Use `openspec init --tools none .` for a fresh root — no project-local
  agent files are generated; the global `/house-*` commands drive the
  workflow.
- Ensure `openspec/config.yaml` sets `schema: house-style`. Preserve
  unrelated OpenSpec configuration and existing changes.
- Verify the global schema resolves: `openspec schema which house-style`
  → `~/.local/share/openspec/schemas/house-style`.

### Primary lifecycle

- **grill** (the grilling skills) — the brainstorm entry. Stress-test the
  idea before it becomes a proposal. If the idea is trivial, skip it;
  ceremony scales with risk.
- **`/house-new`** — creates the change and generates the full planning
  artifact chain: proposal → design → specs → tasks → plan. Planning only;
  never implements.
- **`/house-apply`** — implements through test-first slices, review loops,
  and final verification. Requires a complete `plan.md`.
- **`/house-archive`** — archives the change, writes the retrospective,
  commits, and pushes. Requires checked tasks and a passing `verify.md`.

### Test-first implementation

- Every behavioral task starts with a test that fails before production code
  is written.
- If a task has no meaningful automated test path, record an explicit TDD
  exception in the plan slice before proceeding.
- Do not skip the failing-test step for convenience.

### Review / fix loops

- After each review checkpoint, fix or explicitly disposition every
  actionable finding.
- Rerun review after fixes.
- Do not advance to final verification while actionable findings remain.

### Verification gate

- Run planned checks after each slice and at final verification. Treat any
  `FAILED` or `BLOCKED` result as non-passing: fix, then re-run. Never
  advance on a non-passing check.
- In `verify.md`, record every check's type, exact command, exit code (or
  `NOT RUN`), and outcome.
- Record a passing outcome only when every planned check passed.
- The change is not archive-ready until that record exists.

### Archive discipline

- Archive runs after verification and retrospective are complete.
- Archive ordering: `openspec archive "<name>" -y` → commit → sync origin.
- Do not promise PR creation; only commit and push.

### Active workspace

- Commands operate against the current working directory / active project
  repo. Git checks and `origin` sync always apply to the active workspace,
  never to `~/.pi/agent`.

### Skill availability fallback

- If this skill cannot be loaded, the commands contain embedded step-by-step
  guidance that covers the same workflow. Commands should attempt to load
  this skill when available but must work without it.
