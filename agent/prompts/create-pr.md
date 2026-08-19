---
description: Create a pull request, then babysit it.
argument-hint: "[branch or changes]"
---

Use the `integrator` subagent to create a PR for $ARGUMENTS using the repo's
commit conventions and approved branch.

Return the PR URL or number, then load the `babysit-pr` skill for the
watch / fix / merge loop.

Do not merge unless explicitly approved.
