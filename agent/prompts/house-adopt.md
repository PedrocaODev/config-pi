---
description: Non-destructively adopt an existing OpenSpec repo into the global house-style workflow.
---

# house-adopt

Point an existing OpenSpec repository at the global `house-style` schema
without clobbering local scaffolding.

## Steps

1. **Load the skill if available.**
   Attempt to load `openspec-house-style`. If unavailable, proceed with the
   embedded guidance below.

2. **Verify the global schema exists.**
   Confirm `~/.local/share/openspec/schemas/house-style/schema.yaml` is
   present, and that it resolves: `openspec schema which house-style` →
   `~/.local/share/openspec/schemas/house-style`. If not, stop and explain
   the pack is not installed.

3. **Initialize or update the project without tooling.**
   Work from the project root:
   - If `openspec/` does not exist, run `openspec init . --tools none`.
   - Otherwise, run `openspec update .`.
   `--tools none` is intentional: no project-local agent files are generated;
   the global `/house-*` commands drive the workflow.

4. **Set the schema to house-style.**
   Update `openspec/config.yaml` to set `schema: house-style`. Preserve all
   other existing config keys.

5. **Verify the schema resolves for this project.**
   Confirm the project now uses house-style. Do not remove or replace
   unrelated project-local files or generated assets.

6. **Leave existing changes as-is.**
   Do not migrate or rewrite changes already in `openspec/changes/`.
   The user can migrate them explicitly if desired.

7. **Report result.**
   Tell the user the repo now uses house-style for new changes and existing
   changes are unaffected. Tell the user to run `/reload` so the workflow
   commands are refreshed. Report the lifecycle as brainstorming with the
   grilling skills (`/grilling`, `grill-me`, `grill-with-docs`), proposal
   with `/house-new`, implementation with `/house-apply`, and archive with
   `/house-archive`.

Delegate file edits to the `fixer` subagent. Use repo-local specialists when
available.
