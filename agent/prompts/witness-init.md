---
description: Initialize a repository for the global witness OpenSpec workflow (grill → witness-new → witness-apply → witness-archive)
---

# witness-init

Initialize the active repository to use the global `witness` OpenSpec schema.

## Steps

1. **Load the skill if available.**
   Attempt to load `openspec-witness`. If unavailable, proceed with the
   embedded guidance below.

2. **Verify the global schema exists.**
   Confirm `~/.local/share/openspec/schemas/witness/schema.yaml` is
   present. If not, stop and tell the user the global witness pack is not
   installed.

3. **Create or update the OpenSpec root.**
   Work from the project root. Choose exactly one path:
   - If `openspec/` does not exist, run `openspec init --tools none .`.
   - If it exists, run `openspec update .` (or just leave the root in place —
     `--tools none` means no project-local agent files are generated; the
     global `/witness-*` commands drive the workflow).

4. **Assign the witness schema.**
   Ensure `openspec/config.yaml` sets `schema: witness`. Do not delete or
   overwrite unrelated local config keys.

5. **Verify the schema resolves.**
   Run `openspec schema which witness` and confirm it resolves to the user
   install at `~/.local/share/openspec/schemas/witness`. Then create a
   throwaway check: `openspec new change "__witness-init-check__"` and confirm
   `openspec status --change "__witness-init-check__" --json` reports
   `schemaName: witness`, then remove the change directory.

6. **Report result.**
   Tell the user the repo is ready. The lifecycle from here is:
   `grill → /witness-new → /witness-apply → /witness-archive`. No `opsx-*` commands
   are used.
