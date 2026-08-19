---
description: Launch an iterative code review and fix cycle for the specified code, changes, or files.
argument-hint: "[code, changes, or files to review]"
---

Coordinate a thorough review-and-fix cycle for the specified code, changes,
or files. This is the standalone form of the review loop; when a house-style
change is in apply, the loop writes `review.md` via `/fix-loop` instead.

## Initial review

Delegate the first review to the `oracle` subagent with the complete task
scope and all relevant context. Ask Oracle to inspect:

- Correctness and regression risk
- Performance — time and space complexity where relevant; note when complexity analysis is not applicable
- Memory usage and allocation patterns
- Security vulnerabilities
- Architecture and design quality — god classes, cohesion, coupling, layering
- Maintainability and readability
- Ponytail over-engineering — delete/simplify YAGNI violations, unnecessary abstractions, reinvented stdlib/native features, unneeded dependencies, boilerplate, and dead flexibility

Require findings to include severity, file path, line number, observation,
and recommendation. Keep the Oracle task/session ID for later review passes.

If the initial review has no findings, finish with `SGTM`.

## Info selection

After the initial Oracle review, present the user with a numbered list of all
`info` findings, each with its path, line, and short summary. Ask which
informational findings should be addressed. Accept "none" or an explicit
list. Do not ask this question again during later rounds.

Queue every `critical` and `warning` finding automatically, plus only the
informational findings selected by the user.

## Fix-and-review loop

For each pass with queued findings:

1. Delegate the queued findings to the `fixer` subagent, including the
   original task scope, exact Oracle findings, relevant context, and a
   requirement to make the smallest safe changes and run targeted
   verification.
2. Keep the Fixer task/session ID available for follow-up fixes when the
   same implementation context is useful.
3. After Fixer completes, resume the original Oracle session using its
   existing session ID. Do not create a fresh Oracle session unless
   resumption is impossible.
4. Tell Oracle to inspect the current state and verify every prior queued
   finding, check for regressions introduced by the fixes, and return `SGTM`
   only when all critical/warning findings and all user-selected
   informational findings are resolved.
5. Automatically queue newly reported critical/warning findings. Do not
   queue newly discovered informational findings after the initial
   selection; report them for the final summary instead.

Allow at most **5 Fixer attempts** total. If Oracle has not returned `SGTM`
after the fifth attempt, stop and report the unresolved findings and
remaining uncertainty. Never claim `SGTM` when actionable findings remain.

$ARGUMENTS

The Orchestrator coordinates; Oracle reviews only and must not edit files;
Fixer performs implementation only for the queued findings. Preserve the
original review scope throughout the cycle. Report the final verdict, fixes
performed, unresolved findings, and any later-discovered informational
findings.

If no specific arguments are provided, review the current working context or
the most recent changes.
