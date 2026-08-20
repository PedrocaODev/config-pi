---
name: worktrees
description: Use the installed pi-worktree extension for isolated Git lanes when work needs parallel, risky, or context-preserving execution.
---

# Worktrees

This skill is an **orchestrator-only** workflow for assigning work to isolated
Git lanes. The installed `@narumitw/pi-worktree` extension owns the Git
worktree lifecycle. The Orchestrator owns lane intent, agent assignment,
ownership, validation, integration approval, and cleanup decisions.

## Lifecycle owner: pi-worktree

Use the interactive `/worktree` command without arguments. Do not reproduce its
Git safety logic or maintain a second worktree manifest.

The extension provides:

- **Worktree status** — inspect registered worktrees and local working-tree state.
- **Add worktree** — create a new branch worktree or attach an unoccupied local
  branch, with base and path previews plus confirmation.
- **Switch worktree** — move the Pi conversation into an existing worktree.
- **Remove worktree** — remove an unlocked, non-current linked worktree while
  preserving its branch, after dirty-data and recovery-history checks.
- **Prune stale metadata** — preview and prune stale Git worktree metadata.
- **Configure worktree root** — set the machine-local default location.

The default root is `~/.worktrees`. Configure another root through
**Configure worktree root**; do not assume or create `.pi/worktrees/`.
Git's registered worktree state is the source of truth. Do not create or
maintain `.pi/worktrees.json` for this skill.

The extension asks for confirmation and revalidates state before supported Git
mutations. Use Git directly only for operations the extension intentionally
does not expose: force removal, branch deletion, move, repair, lock/unlock,
detached or orphan worktrees, custom prune expiry, or remote refresh.

## Workflow

### 1. Plan the lane

Use a worktree only for risky refactoring, parallel work, experiments,
third-party upgrades, or an explicit worktree request. For a small isolated
change, work in the current checkout.

Choose:

- a short branch name, normally `pi/<slug>`;
- the base branch or commit;
- the agent and exact files or directories it owns;
- the validation command the lane must pass.

Before creating a lane, inspect the current repository state and existing
worktrees. Ask for confirmation before any lifecycle mutation.

### 2. Create or select it through the extension

Run `/worktree`, choose **Add worktree**, and review the extension's branch,
base commit, and target path preview before confirming. Use **Switch
worktree** when the lane already exists and the current Pi conversation should
continue there.

If the extension reports dirty, locked, stale, occupied, or unreachable state,
resolve that state explicitly; do not bypass its safety checks with force flags.
Completion criterion: the target is registered by Git and, when requested, the
Pi session reports that it is running from the target path.

### 3. Delegate inside the lane

Run every assigned agent with its working directory set to the selected
worktree path. Agents must not edit the main checkout for lane work. Keep file
ownership disjoint when multiple lanes run in parallel.

Commit inside the worktree only when the task or integration workflow requires
checkpoint commits. Record the lane's purpose and owner in the task or session
context, not in a second lifecycle database.

### 4. Validate and integrate

Run the assigned lint, build, format, and test checks inside the worktree.
Inspect the diff against the integration base and report the worktree path and
branch. Ask for approval before merging, rebasing, cherry-picking, or otherwise
integrating changes into another checkout. The extension does not perform
integration.

### 5. Remove or prune through the extension

Before cleanup, confirm that the changes are merged or intentionally archived
and that the lane has no required uncommitted data. Ask for confirmation, then
run `/worktree` → **Remove worktree**. The branch is preserved by default.
Use **Prune stale metadata** only for Git worktrees that are already stale.

The extension refuses removal of the current or main worktree and protects
tracked, untracked, staged, submodule, index-flagged, locked, and unreachable
recovery data. Preserve any recovery-only commit that matters by creating a
branch or tag before cleanup.

## Do not use

Do not use this workflow for a simple single-file change, documentation-only
edit, or minor fix that does not need checkout isolation. Do not hand-roll
parallel worktree paths, lifecycle manifests, cleanup scripts, or duplicate
preflight checks.

ponytail: the extension's Git registry replaces a separate `.pi/worktrees.json`
manifest; add project-specific lane metadata only when a concrete workflow
needs information Git and the task context cannot provide.
