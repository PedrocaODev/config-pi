---
name: issue-workflow
description: Refine an issue with a grilling session, then drive it through the house-style OpenSpec lifecycle (grill → house-new → house-apply → house-archive). Use when the user is working on an issue — mentions an issue, pastes an issue URL or number, or wants to refine, scope, implement, or close an issue.
---

# Issue Workflow: grill → house-style OpenSpec

Two-phase workflow for taking an issue from raw idea to shipped, archived change. Phase 1 is an interview; Phase 2 is the house-style pipeline. Never skip Phase 1's confirmation.

## Phase 1 — Refine (grill-me)

1. **Read the issue.** If it is a GitHub URL or `#N`/`owner/repo#N` reference and `gh` is available, run `gh issue view <ref>` and read the body and comments. Otherwise use the conversation context. Never ask the user for anything you can look up yourself.
2. **Run a grilling session** (per the `grilling` skill): interview the user relentlessly in rounds, mapping a design tree. Each round asks the whole current frontier — numbered questions, each with your recommended answer — then waits for the user's answers. Settled decisions push the frontier outward; recompute and ask the next round.
3. **Find facts yourself.** When a frontier question needs a fact from the environment (repo layout, existing OpenSpec specs, similar past changes, code seams), look it up — never hand the user a question you could answer by reading. Don't block the rest of the frontier on it.
4. **Stop when the frontier is empty** — every branch of the design tree visited, nothing silently assumed. Present the shared understanding and get explicit user confirmation. **Do NOT start Phase 2 until the user confirms.**

   *Trivial, clear issue?* Grilling is for meaningful decisions. If the issue is small and the decision is clear, skip the interview — ceremony scales with risk.

## Phase 2 — House-style OpenSpec

Only after the user confirms the refined understanding (or the issue was trivial):

1. **Bootstrap if needed** — `/house-init` if the repo has no `openspec/` root with `schema: house-style`.
2. **Propose** — `/house-new "<kebab-case-name>"`: creates the house-style planning artifacts in dependency order — proposal → design → specs → tasks → plan — each via `openspec instructions <artifact> --change "<name>" --json`. Planning only.
3. **Review** — present the artifacts; the user reviews before any code is written.
4. **Apply** — `/house-apply`: implement the plan's test-first slices, run review at checkpoints, run final verification, and write `verify.md` (post-review verification record with every check's command, exit code, and outcome).
5. **Archive** — `/house-archive`: confirm tasks checked + `verify.md` passing, finalize `retrospective.md`, `openspec archive "<name>" -y` (syncs delta specs), commit, push.

## Routing rules (house-style — mandatory)

- The lifecycle is `grill → house-new → house-apply → house-archive`. **No `opsx-*` commands are used** — the generated `opsx-propose`/`opsx-apply`/`opsx-archive` flow is not part of this workflow.
- Grilling replaces the brainstorming/exploration step. `/house-new` is the proposal entry.

## Hard rules

- The grilling phase authorizes nothing beyond shared understanding. Do not create change artifacts until the user confirms.
- The proposal phase authorizes planning only. Do not implement, and do not let a request to "build" or "fix" in the issue carry implementation into the planning response.
- Apply reads context files from disk (`openspec instructions apply --change "<name>" --json` → `contextFiles`), re-reading them even if seen earlier — the user may have edited them.
- When implementation reveals a design issue, pause and suggest updating the artifacts, not silently deviating.
- A non-passing check never advances the workflow — fix and re-run.
