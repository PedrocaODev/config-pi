---
name: git-master
description: git commit, staging, split commits, logical commits, git push, gh pr create, PR checks, CI watch, checks green, commit splitting, hunk staging, commit batching, origin sync. Use for disciplined Git execution where changes must be grouped by meaning, not blindly committed. Covers inspection, hunk-level staging, logical commit batches, push, PR follow-through, and CI verification.
---

# Git Master — Disciplined Commit Execution

## Overview

This skill covers the full write-side Git workflow: inspecting changes, splitting
them into logically coherent commits, pushing to `origin`, and verifying CI. It
is execution-oriented — the goal is clean commit history and confirmed green
state, not just "push succeeded."

## When to Use

- The task involves committing changes that span multiple concerns (refactor +
  feature, config + logic, formatting + behavior).
- You need to split a working tree into multiple logical commits.
- You want disciplined staging (hunk-level) instead of `git add .`.
- The task requires push, PR creation, or CI verification.
- The user asks for clean, reviewable commit history.

**When NOT to use:**

- Read-only git inspection (`git status`, `git log`, `git diff` for context
  only) — no staging or committing involved.
- The change is trivial and a single atomic commit is obviously correct.
- The user explicitly wants a single squashed commit.

## Core Principles

1. **Inspect before staging.** Never `git add .` blindly. Read `git status`,
   `git diff`, and `git diff --staged` before every commit.
2. **Group by meaning.** Commits are split by logical intent — refactor vs
   feature vs test update vs config vs formatting — not by file type or
   alphabetical ordering.
3. **Avoid mixing unrelated changes.** One commit = one purpose. If a file
   contains edits for two unrelated reasons, split the hunks.
4. **Keep prerequisites separate.** When a prerequisite change (e.g., a utility
   extraction, a config flag, a base type) helps reviewability, commit it first
   as its own unit.
5. **Formatting-only is its own commit.** Whitespace, import ordering,
   lint fixes, and other non-behavioral changes go in a dedicated commit — never
   mixed with logic changes.
6. **Test-only is its own commit when useful.** When test updates are large or
   independent of the behavior change they accompany, separating them improves
   review.
7. **Match repo conventions.** Read `AGENTS.md`, recent `git log`, and any
   commit message templates before writing messages.
8. **Finish the job.** A local commit is not done. If a commit was requested and
   created, treat sync to `origin` as part of completing the task — unless the
   user explicitly wants local-only, push is blocked by permissions/policy, or
   the remote operation fails.
9. **Never force-push unless explicitly asked.** Force-push is a user-directed
   action, not a default recovery strategy.
10. **Verify after push.** Pushing is not the finish line. Confirm CI/check state
    before declaring done.

## Workflow

### Step 1: Inspect the Full Picture

Before touching the staging area:

```
git status
git diff
git log --oneline -10
```

- Identify every modified/added/deleted file.
- For each file, understand *why* it changed.
- Note files that contain mixed concerns — these need hunk-level splitting.

### Step 2: Group Changes by Logical Intent

Mentally (or explicitly) partition the working tree into commit units. Common
categories:

| Category | Example |
|---|---|
| **Refactor** | Rename, extract, reorder — no behavior change |
| **Feature / behavior** | New logic, changed API surface, new functionality |
| **Bug fix** | Correcting existing behavior |
| **Test update** | New or changed test expectations |
| **Config / infra** | CI, build, dependency, env, tooling changes |
| **Formatting / lint** | Whitespace, import order, lint autofix — no behavior change |
| **Docs** | README, comments, docstrings — no code change |

Order commits so each builds on the previous: prerequisite changes first, then
dependent features, then tests, then formatting cleanup.

### Step 3: Stage and Commit Each Unit

For each logical unit:

1. **Stage precisely.** Use `git add -p <file>` for files that span multiple
   concerns, or `git add <specific-files>` for clean units.
2. **Verify staging.** Run `git diff --staged` and confirm only the intended
   changes are included.
3. **Commit with a clear message.** Match the repo's style:
   - Check recent `git log --oneline -20` for conventional-commit patterns,
     capitalization, scope conventions, etc.
   - Keep the subject line under ~72 characters when possible.
   - Add a body when the *why* is not obvious from the subject alone.
   - Reference issue/PR numbers if the repo uses them.

Example commit sequence for a mixed working tree:

```
1. refactor: extract validateConfig helper from server.ts
2. feat: add rate-limit middleware
3. test: add rate-limit integration tests
4. chore: update eslint config for new rules
5. style: fix import ordering across src/
```

### Step 4: Push and Confirm Sync

```
git push -u origin <branch>
```

- If upstream already exists, `git push` is sufficient.
- After a successful push, confirm the branch is in sync with `origin`.
- If push fails, surface the exact error and stop — do not claim completion.
- Do not declare success at "commit created" if the branch is still unsynced.

### Step 5: PR Follow-Through (when applicable)

If the task includes creating a PR or the user requests one:

1. Create the PR with `gh pr create`.
2. **Return the PR URL immediately.**
3. Inspect the PR's checks without delay.
4. Watch the initial CI/check run long enough to catch failures or confirm a
   clean start.

### Step 6: Verify CI / Checks

After a successful push (and PR creation, if applicable), observe the remote
state:

**If the repo uses GitHub (`gh` available):**

```
gh pr checks <pr-number> --watch
# or, if no PR exists yet:
gh run list --branch <branch> --limit 5
gh run watch <run-id>
# fallback for detailed check status:
gh pr view <pr-number> --json statusCheckRollup
```

- Prefer `gh pr checks --watch` for PRs — it blocks until checks resolve.
- Use `gh run watch` for direct branch checks or workflow monitoring.
- Use `gh pr view --json statusCheckRollup` when `--watch` is insufficient or
  you need granular per-check detail.
- If checks are still pending after a reasonable window (default: ~5 minutes of
  active watching), **report pending explicitly** instead of claiming green.

**If the repo uses a different CI surface:**

- Use whatever project tools are available (e.g., `make ci`, `npm run
  test:ci`, a local CI dashboard URL, etc.).
- Report the tool used and the observed state.

**If CI cannot be observed:**

- State clearly: "CI state could not be verified — [reason]."
- Do not silently assume green.

## Commit Grouping Guidance

### When to split a file across two commits

A single file may contain unrelated edits (e.g., a refactor that also fixes a
bug, or formatting that landed alongside a feature change). In that case:

1. Use `git add -p <file>` to stage individual hunks.
2. Commit the hunk under the appropriate logical category.
3. Stage the remaining hunks and commit them separately.

### When NOT to split

- If every hunk in a file serves the same purpose, keep it in one commit.
- If the changes are tightly coupled (e.g., a rename and its call-site
  updates), keep them together — splitting would break bisectability.
- If the repo has a "squash on merge" policy, over-splitting adds noise without
  review benefit. Use judgment.

### Dependency ordering

When commit B depends on commit A (e.g., A extracts a utility that B uses):

- Commit A first.
- Commit B second.
- Do not reverse this order or combine them unless the repo prefers atomic
  squash commits.

## CI Watch Guidance

- Start watching immediately after push — do not move on and come back later.
- If `gh pr checks --watch` is available, use it. It is the most reliable
  one-shot CI observation command.
- If a check fails, collect:
  - The failing workflow/job name.
  - The failing step or a short error summary.
  - A pointer to the next diagnostic action (e.g., "check `test:unit` output
    for assertion failure in `auth.test.ts`").
- If checks are pending beyond a reasonable window, say so explicitly:
  "Checks are still pending after N minutes. I cannot confirm green state yet."
  Do not fabricate a pass.
- If the push did not create a PR and no CI triggers on branch push, report
  that too.

## Verification Checklist

Before declaring the task done:

- [ ] Every logical unit was committed separately with a clear message.
- [ ] No commit mixes unrelated concerns.
- [ ] `git diff` (working tree) is clean — no stray uncommitted changes.
- [ ] `git log --oneline` shows the expected commit sequence.
- [ ] Each commit was pushed to `origin` and the branch is in sync.
- [ ] If a PR was requested, it was created and the URL was returned.
- [ ] CI/check state was observed and reported (green, pending, or failed).
- [ ] If checks failed, the failure details and next steps were surfaced.
- [ ] PR has been merged, local branch has been synced.

## Done Criteria

- All changes are committed in logically separated, well-messaged batches.
- The branch is pushed and in sync with `origin`.
- If a PR was part of the task, it exists and its URL was returned.
- CI/check state is confirmed green **or** explicitly reported as pending/failed
  with actionable detail.
- A concise summary was returned: what was committed (grouped), what was pushed,
  and the observed CI state.
