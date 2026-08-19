---
description: Babysit a PR through CI, fixes, review, push, and optional merge.
argument-hint: "[PR number, PR URL, or current branch]"
---

Use the `babysit-pr` skill.

Accept a PR number, PR URL, or current branch. If omitted, infer the PR only
when it is unambiguous; otherwise ask a focused question before proceeding.

Follow the skill's workflow to watch CI, route failures through the `runner`,
`fixer`, `oracle`, and `integrator` subagents, and only merge when the user
explicitly requested merge-on-green or automerge. The `integrator` merge
gate applies: merging requires a recorded user approval (see
`/approve-merge`); never merge without it.
