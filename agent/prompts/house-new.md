---
description: "House-style: propose a new change - create it and generate the full artifact chain (proposal → design → specs → tasks → plan)"
---

# house-new

Propose a new change using the `house-style` OpenSpec schema — create the change and generate every planning artifact in one step.

**Planning boundary**: This workflow creates planning artifacts only. The user request that selected or triggered this workflow authorizes planning only, even if it asks to build or fix something. Do not edit project code. After the planning artifacts are complete, stop. Do not start implementation in the same response. Wait for a new user request; implementation starts with `/house-apply`.

The house-style artifact chain, in dependency order:
- `proposal.md` (what & why)
- `design.md` (context, decisions, trade-offs, risks)
- `specs/<capability-path>/spec.md` (delta specs: ADDED / MODIFIED / REMOVED with Given/When/Then acceptance criteria)
- `tasks.md` (ordered implementation tasks)
- `plan.md` (test-first slices, review checkpoints, final verification intent — this is the apply gate)

`<capability-path>` is the spec directory relative to `specs/` (for example, `user-auth` or `identity/user-auth`). Preserve an existing capability's full path and follow the project's established organization for new capabilities.

**Input**: The argument after `/house-new` is the change name (kebab-case), OR a description of what the user wants to build.
**Provided arguments**: $@

**Steps**

1. **Understand the request and clarify material ambiguity**

   If no input is provided, ask the user (open-ended, no preset options):
   > "What change do you want to work on? Describe what you want to build or fix."

   From their description, derive a kebab-case name (e.g., "add user authentication" → `add-user-auth`).

   If the request contains ambiguity that would materially affect scope, externally observable behavior, compatibility, or acceptance criteria, ask the user before creating the change. For minor details, make a reasonable assumption and record it in the planning artifacts.

2. **Determine the workflow schema**

   Use `house-style` (the active schema for this workflow) unless the user explicitly requests a different one — then pass `--schema <schema-name>`.

3. **Create the change directory**
   ```bash
   openspec new change "<name>"
   ```

4. **Get the artifact build order**
   ```bash
   openspec status --change "<name>" --json
   ```
   Parse the JSON to get:
   - `applyRequires`: array of artifact IDs needed before implementation (house-style: `["plan"]`)
   - `artifacts`: list of all artifacts, each with its `status` and its `requires` edges (the artifact IDs it directly depends on)
   - `planningHome`, `changeRoot`, `artifactPaths`, and `actionContext`: path and scope context. Use these instead of assuming repo-local paths.

5. **Create every artifact in the required set**

   Use a todo list to track progress through the artifacts.

   Loop through artifacts in dependency order (artifacts with no pending dependencies first):

   a. **For each artifact that is `ready` (dependencies satisfied)**:
      - Get instructions:
        ```bash
        openspec instructions <artifact-id> --change "<name>" --json
        ```
      - The instructions JSON includes `context` (project background — constraints for you, do NOT include in output), `rules` (artifact-specific constraints — do NOT include in output), `template` (the structure for your output file), `instruction` (schema-specific guidance), `resolvedOutputPath` (where to write the artifact), and `dependencies` (completed artifacts to read for context).
      - Read any completed dependency files for context — always re-read them from disk, even if you saw them earlier in the conversation (the user may have edited them).
      - Create the artifact file using `template` as the structure, written to `resolvedOutputPath`. If `resolvedOutputPath` is a glob, follow `instruction` to choose the concrete file path.
      - Show brief progress: "Created <artifact-id>"

   b. **Continue until every artifact in the required set exists** (not just `apply.requires`):
      - After creating each artifact, re-run `openspec status --change "<name>" --json`
      - The required set is `applyRequires` plus every artifact reachable from those by following the `requires` edges — walk them transitively (house-style closes over proposal, design, specs, tasks, plan). Leave artifacts outside that set alone.
      - `status` is file-existence only, so an `applyRequires` artifact reading `done` does NOT mean its dependencies exist. Use each artifact's `requires` edges, not its `status`, to build the required set.
      - An artifact already reading `status: "skipped"` is satisfied (the change declares `skip_specs`); its files must NOT exist.
      - Skip an artifact only when `status` reports it `skipped`, or when its own `instruction` marks it optional. Dependencies are enablers, not gates: if a required artifact is still `blocked` only because you skipped a conditional dependency, write it anyway.
      - Stop when every artifact in the required set is `done`, `skipped`, or was deliberately skipped.

   c. **If an artifact requires user input** (unclear context):
      - Ask the user to clarify, then continue with creation.

6. **Show final status**
   ```bash
   openspec status --change "<name>"
   ```

**Output**

After completing all artifacts, summarize:
- Change name and location
- List of artifacts created with brief descriptions, plus any conditional artifact you skipped and why
- What's ready: "All artifacts needed for implementation are ready."
- Prompt: "The artifacts are ready for review. When you are ready, run `/house-apply`."

**Artifact Creation Guidelines**

- Follow the `instruction` field from `openspec instructions` for each artifact type — it is the authoritative guidance, even for familiar artifact names.
- Read dependency artifacts for context before creating new ones.
- Use `template` as the structure for your output file — fill in its sections.
- `context` and `rules` are constraints for YOU, not content for the file. Do NOT copy `<context>`, `<rules>`, `<project_context>` blocks into the artifact.

**Guardrails**
- The request that invoked this workflow authorizes planning only. Do NOT implement the change, start apply, or edit project code during this workflow. After presenting the artifacts, stop and wait for a new user request to start `/house-apply`.
- Create every artifact the apply phase transitively depends on, not just the ids listed in `apply.requires`.
- Always read dependency artifacts before creating a new one — re-read from disk, not from conversation memory (files may have changed since you last saw them).
- Ask about ambiguities that would materially change scope, externally observable behavior, compatibility, or acceptance criteria; for minor details, make reasonable assumptions and record them.
- If a change with that name already exists, ask if the user wants to continue it or create a new one.
- Verify each artifact file exists after writing before proceeding to next.
- No `opsx-*` commands are used in this workflow. The next step after planning is always `/house-apply`.
