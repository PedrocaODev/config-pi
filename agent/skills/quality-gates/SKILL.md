---
name: quality-gates
description: "Set up or tighten project git hooks and quality gates. Use when the user wants to add pre-commit hooks, pre-push checks, lint-on-save, typecheck guards, test gates, formatting enforcement, husky/lefthook/pre-commit/simple-git-hooks setup, or any automated validation that runs before commit or push. Front-loads: quality gates, git hooks, pre-commit, pre-push, lint, test, typecheck, green, formatting, validation, guard."
---

# Quality Gates

Set up project-local git hooks and quality gates that catch problems before they
reach CI. This skill guides the agent through discovering the right validation
commands from the codebase itself, wiring them into committed hook mechanisms, and
verifying that the full check suite passes before declaring the gates ready.

## When to Use

- User asks to set up git hooks, pre-commit, pre-push, or quality gates
- User wants linting, formatting, typechecking, or tests to run automatically
- User wants to tighten or improve an existing hook setup
- User mentions husky, lefthook, pre-commit, simple-git-hooks, or similar tools
- User wants to enforce formatting (prettier, biome, black, etc.) on commit
- User wants to catch type errors or lint violations before push

**When NOT to use:**

- User only wants to run a one-off lint/test command (no hook wiring needed)
- User wants CI-level checks (GitHub Actions, etc.) without local hooks
- The task is about pi extension hooks, not project git hooks
- User wants to modify linter/tester config, not the hook pipeline

## Core Principles

### 1. Discover commands from the codebase — never invent them

Read `package.json` scripts, `Makefile` targets, `justfile` recipes, `pyproject.toml`
tool configs, or whatever the project actually uses. If the repo has no lint/test
commands, surface that to the user instead of guessing.

### 2. Prefer committed, project-local hook mechanisms

Use whatever the project already has. If nothing exists, prefer tools that live in
the repo and are committed to git, so every contributor gets the same hooks:

| Ecosystem | Preferred tools (in priority order) |
|---|---|
| Node/JS/TS | husky, simple-git-hooks, lefthook, lint-staged + package scripts |
| Python | pre-commit framework, Makefile/tox targets |
| Rust | lefthook, Makefile |
| Go | lefthook, Makefile |
| Mono/multi | lefthook, Makefile, justfile |

If the project already has a hook tool installed, **use it**. Do not add a
second hook system alongside the first.

### 3. Minimal diffs — do not refactor the project

Adding hooks means changing as little as possible. Do not reorganize scripts,
rename existing tools, or upgrade dependencies unless the user explicitly asks.

### 4. Split by speed: fast checks on commit, heavy checks on push

- **Pre-commit:** fast, staged-only checks. Formatting, linting on changed files,
  quick type-sanity checks. Should complete in a few seconds.
- **Pre-push:** heavier, repo-wide checks. Full typecheck, full test suite, build
  verification. These take longer and are acceptable to run before push.

Not every project needs both. Some projects only need pre-commit. Adjust to the
project's size and tooling speed.

### 5. Do not install always-failing hooks onto a red codebase

Before wiring hooks, run the chosen checks against the current codebase. If the
repo is already failing, **tell the user** and offer options:

- Fix the existing failures first, then install hooks
- Narrow the hook scope to only catch new violations (e.g., lint only changed
  files, skip typecheck until the codebase is clean)
- Install hooks but make them advisory (warn, don't block) until the baseline
  is green

Never install blocking hooks on a red codebase and declare success.

### 6. Orchestrator does not write code

Per global rules, the orchestrator plans and delegates. If the skill produces a
plan, the actual hook file creation, script wiring, and config editing belong to
the `fixer` subagent. The orchestrator owns discovery, verification, and
reporting.

## Workflow

### Step 1: Read project context first

Before any setup, inspect the repo:

1. Read `AGENTS.md` / project conventions if they exist
2. Read `package.json` (scripts, devDependencies), `Makefile`, `justfile`,
   `pyproject.toml`, `Cargo.toml`, `go.mod`, or equivalent
3. Check for existing hook tooling: `.husky/`, `.pre-commit-config.yaml`,
   `lefthook.yml`, `.simple-git-hooks.*`, `.git/hooks/` (note if non-standard
   hooks are present)
4. Check for existing formatter/linter/typechecker/test configs
5. Note the project's language, package manager, and test framework

### Step 2: Discover the real validation commands

Identify what commands the project actually runs for validation. Look for:

- **Formatting:** prettier, biome format, black, rustfmt, gofmt
- **Linting:** eslint, biome lint, ruff, pylint, golangci-lint, clippy
- **Type checking:** tsc, mypy, pyright, go vet
- **Testing:** vitest, jest, pytest, cargo test, go test
- **Building:** tsc, vite build, cargo build, go build

Map each category to the exact command from the project's scripts/configs. If a
category has no command, note it as absent — do not fabricate one.

### Step 3: Check the current codebase state

Run the discovered commands to see if the repo is currently green:

- Run the formatter check (e.g., `prettier --check .`, `biome check`)
- Run the linter (e.g., `eslint .`, `biome lint`)
- Run type checking (e.g., `tsc --noEmit`)
- Run the test suite (e.g., `vitest run`, `pytest`)

Record pass/fail for each. If anything fails, flag it before proceeding.

### Step 4: Propose the hook plan

Present the user with a clear plan:

- Which hook tool will be used (or confirmed as already present)
- Which checks go in pre-commit (fast, staged-only)
- Which checks go in pre-push (heavy, repo-wide)
- What the current codebase state is (green/red per category)
- Any caveats or scoping adjustments needed

Ask for confirmation before implementing.

### Step 5: Implement hooks

Delegate the implementation work to the `fixer` subagent:

1. Install the hook tool if not already present (e.g., `husky install`, `pip install pre-commit`)
2. Configure the hooks with the discovered commands
3. For staged-only checks, use lint-staged, pre-commit's built-in file scoping,
   or equivalent per-tool mechanism
4. Ensure hook scripts are executable and correctly referenced
5. Add any necessary devDependencies or config files
6. Update `package.json` scripts if needed (e.g., `"prepare": "husky install"`)

### Step 6: Verify

After implementation, run the full verification:

1. Install the hooks (e.g., `npx husky install`, `pre-commit install`)
2. Stage a test file that intentionally has a lint/format issue
3. Attempt to commit — verify the hook catches it
4. Run the full check suite outside of hooks to confirm everything is green
5. If pre-push hooks were added, verify the push path works on a clean state

### Step 7: Document briefly

After setup, report to the user:

- What hooks were added and where they live (file paths)
- Which commands each hook runs
- How to bypass hooks if needed (e.g., `git commit --no-verify`, `SKIP=lint git commit`)
- Any baseline issues that remain (if the repo was partially red)

## Hook Design Guidance

### Pre-commit (fast, staged-only)

Good candidates for pre-commit:

- Format changed files (prettier, black, biome format)
- Lint changed files only (eslint with lint-staged, ruff on staged)
- Quick syntax or import checks
- Prevent secrets or large files from being committed

Keep it fast. If pre-commit takes more than 5-10 seconds on a typical change,
something is wrong — either too much is running or file scoping is missing.

### Pre-push (heavy, repo-wide)

Good candidates for pre-push:

- Full typecheck (`tsc --noEmit`)
- Full test suite
- Build verification
- Integration tests that take longer

These can take 30-60+ seconds. The tradeoff is acceptable because push is less
frequent than commit.

### Avoid

- Running the full test suite on every commit (too slow)
- Running repo-wide lint on every commit (too slow, use staged scoping)
- Hooks that require network access or external services
- Hooks that modify files silently (auto-format on commit is fine if it only
  formats staged files, but hooks that rewrite unstaged changes are dangerous)

## Verification Checklist

Before declaring the setup complete, confirm:

- [ ] Hook tool is committed to the repo (not just locally installed)
- [ ] Hook config is committed (`.husky/pre-commit`, `.pre-commit-config.yaml`, etc.)
- [ ] Pre-commit hooks run staged-only checks and complete quickly
- [ ] Pre-push hooks (if any) run the heavier repo-wide checks
- [ ] The full relevant check suite passes on the current codebase
- [ ] The hooks correctly catch intentional violations in a test commit
- [ ] No duplicate hook systems are present
- [ ] The user knows how to bypass hooks when needed
- [ ] Any remaining baseline failures are documented, not hidden

## Done Criteria

The quality gates setup is complete when:

1. Committed, project-local hooks exist and are documented in the repo
2. The hooks run the correct, project-specific validation commands
3. Fast checks (format, lint) run on commit; heavy checks (typecheck, test) run
   on push when appropriate
4. The full check suite passes on the current codebase, or blockers are clearly
   reported with a plan to resolve them
5. The user understands what runs, where it lives, and how to work around it
