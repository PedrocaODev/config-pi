---
description: Run the general review-and-fix loop for a pinned code scope.
argument-hint: "[fixed-point] [scope]"
---

Run the general review-and-fix loop for `$ARGUMENTS`.

## Pin the review scope

1. Identify a supplied commit, branch, tag, or merge-base as the fixed point.
   If none is supplied, ask exactly one focused question: “What commit,
   branch, tag, or merge-base should I pin as the review fixed point?” Stop
   until the user answers; do not infer one from the current state.
2. Pin that fixed point and define one review scope from it and the requested
   scope. Pass the identical fixed point and scope to every review lane for
   every round.

## Initial passes

On every invocation, load and execute both `code-review` and
`ponytail-review` as the source of truth for their respective passes. Also
have the `oracle` subagent perform a focused, read-only review of correctness
and regression risk, security and data safety, performance and memory where
applicable, and concrete architecture risks. Oracle must avoid the Standards
+ Spec and over-engineering/deletion checks owned by the other lanes.

Launch the three initial passes independently, in parallel when the harness
permits:

- `code-review`: owns Standards + Spec.
- `ponytail-review`: owns over-engineering and deletion.
- `oracle`: owns the focused correctness/risk review above.

Keep the Oracle session ID for later rounds. Normalize every lane's findings
to Oracle's existing `blocking`/`non-blocking` severity and findings contract,
while preserving the source lane and finding identity. Queue every open
blocking finding automatically. Present all initial open non-blocking findings
once as a numbered list and ask which, if any, to fix; accept `none` or an
explicit list. Do not ask this question again.

## Fix-and-review loop

For each queued blocking finding and each initially selected non-blocking
finding:

1. Delegate the current queue to `fixer`, including the pinned point, identical
   review scope, exact findings, and a request for the smallest safe changes
   with targeted verification. Reuse the Fixer session when useful.
2. Count the delegation as one Fixer attempt. Allow at most **5** attempts
   total.
3. After each fix, rerun all three lanes against the current state and the
   same pinned scope. Load and execute both review skills again. Run the
   passes independently/in parallel when possible. Resume the original Oracle
   session so it verifies its prior findings and checks for regressions; use a
   fresh Oracle session only if resumption is impossible.
4. Normalize the results again. Require each lane to verify its own prior
   findings and report regressions within its boundary. Mark prior findings
   fixed or still open, queue every newly reported blocking finding, and keep
   unresolved initially selected non-blocking findings queued. Newly reported
   non-blocking findings from later rounds are reported but are not auto-fixed.

Continue until there are no open blocking findings. If the fifth attempt ends
with an open blocking finding, stop and report the unresolved findings and
remaining uncertainty. Do not claim `SGTM` while any open blocking finding
remains. If selected non-blocking findings remain after the cap, report them
without claiming that they were fixed. Later non-blocking findings belong in
the final report.

Use `SGTM` only after the blocking queue is clear. Report the final verdict,
fixes performed, unresolved blocking findings, selected non-blocking findings
that remain, and later-discovered non-blocking findings.

$ARGUMENTS

The Orchestrator coordinates. Oracle is read-only and does not run tests,
builds, or diagnostics; Fixer implements queued changes. Preserve the pinned
point and review scope throughout.
