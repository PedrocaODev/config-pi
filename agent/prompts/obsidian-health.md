---
description: Vault health audit - contradictions, gaps, stale claims, orphans, freshness, typed-edge lint (Sunday ritual)
---
Read _CLAUDE.md. This is a scheduled vault health audit - run the checks, apply only safe fixes, log the outcome. The skill root is /home/pedrogoncalves/projects/obsidian-second-brain (substitute for SKILL_ROOT below).

Step 1 - Structural scan:
Run: `uv run --directory /home/pedrogoncalves/projects/obsidian-second-brain scripts/vault_health.py --path /home/pedrogoncalves/pi-second-brain --json`
Parse the JSON. Wanted notes (linked but unwritten) are a wishlist, NOT errors - report the count but do not treat them as breakage.

Step 2 - Freshness lint:
Run: `uv run --directory /home/pedrogoncalves/projects/obsidian-second-brain scripts/freshness_lint.py --path /home/pedrogoncalves/pi-second-brain --json`
FRESH-1 errors are undated fast facts (present-tense claims about counts/statuses with no `as of` stamp). FRESH-2 warnings are aged stamps. Never delete - restamp, convert to a pointer, or mark superseded.

Step 3 - Typed-edge lint:
Run: `uv run --directory /home/pedrogoncalves/projects/obsidian-second-brain scripts/link_graph.py --path /home/pedrogoncalves/pi-second-brain --lint`
Zero findings on a vault with no relations: blocks is a normal result, not an error.

Step 4 - Merge and group by severity:
- RED (critical): unfilled template syntax, contradictions between notes, typed-edge contradiction cycles, code-fence-wrapped notes
- YELLOW (warning): duplicates, stale tasks, missing frontmatter, stale claims, concept gaps, freshness violations, typed-edge problems (unknown type, dangling target, self-edge)
- WHITE (info): wanted notes, orphaned notes, empty folders, missing inverse edges

Step 5 - Safe fixes (DO these, unattended):
- Add missing frontmatter to notes that lack it
- Unwrap code-fence-wrapped notes (strip the leading ```markdown fence and matching closing fence; never add a second frontmatter block)
- Create pages for concept gaps (terms mentioned 3+ times with no dedicated page) following references/ai-first-rules.md
- Only if obviously safe: merge exact duplicates

Step 6 - Destructive fixes (DO NOT touch, unattended):
- Archiving, merging ambiguous notes, resolving contradictions - list them in the summary as needing an interactive /obsidian-reconcile or /obsidian-health run.

Step 7 - Log:
Append an operation-log entry: if `Logs/` exists write `**HH:MM** - health | X critical, Y warnings, Z info` to `Logs/YYYY-MM-DD.md`; otherwise append `## [YYYY-MM-DD] health | X critical, Y warnings, Z info` to `log.md`

Do not ask questions. Report the severity counts and what you fixed in your final message. Save and stop.
