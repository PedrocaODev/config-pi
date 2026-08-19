---
description: Initialize a repository for the global house-style OpenSpec workflow (grill → house-new → house-apply → house-archive)
---

# house-init

Initialize the active repository to use the global `house-style` OpenSpec schema.

## Steps

1. **Load the skill if available.**
   Attempt to load `openspec-house-style`. If unavailable, proceed with the
   embedded guidance below.

2. **Verify the global schema exists.**
   Confirm `~/.local/share/openspec/schemas/house-style/schema.yaml` is
   present. If not, stop and tell the user the global house-style pack is not
   installed.

3. **Create or update the OpenSpec root.**
   Work from the project root. Choose exactly one path:
   - If `openspec/` does not exist, run `openspec init --tools none .`.
   - If it exists, run `openspec update .` (or just leave the root in place —
     `--tools none` means no project-local agent files are generated; the
     global `/house-*` commands drive the workflow).

4. **Assign the house-style schema.**
   Ensure `openspec/config.yaml` sets `schema: house-style`. Do not delete or
   overwrite unrelated local config keys.

5. **Verify the schema resolves.**
   Run `openspec schema which house-style` and confirm it resolves to the user
   install at `~/.local/share/openspec/schemas/house-style`. Then create a
   throwaway check: `openspec new change "__house-init-check__"` and confirm
   `openspec status --change "__house-init-check__" --json` reports
   `schemaName: house-style`, then remove the change directory.

6. **Report result.**
   Tell the user the repo is ready. The lifecycle from here is:
   `grill → /house-new → /house-apply → /house-archive`. No `opsx-*` commands
   are used.
