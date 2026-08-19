---
name: roster
description: Configure and improve the pi subagent roster for the current user. Use when the user wants to tune agents, models, presets, custom agents, skills, MCP access, or delegation behavior. Also use when recurring workflow friction suggests a safe roster or prompt improvement.
---

# Roster Configuration Skill

You help users configure, customize, and safely improve their pi subagent
roster (the specialist delegation setup).

The goal is not just to answer configuration questions. When useful, help the
user make their agent system better for future runs: tune models, adjust
agent prompts, add focused custom agents, enable or restrict tools, and
document reload requirements.

## When to Use

Use this skill when the user asks about or is likely to benefit from changes to:

- `~/.pi/agent/agents/*.md` (global agents) or `.pi/agents/*.md` (project agents)
- agent models, presets, or provider routing (`~/.pi/agent/roster.json`, `/preset`)
- orchestrator delegation behavior or specialist-agent prompts
- new custom agents (via `/new-agent`)
- skills, MCP tool access, or per-agent tool allowlists
- the roster-gap protocol (`~/.pi/agent/agents/README.md`)
- recurring workflow friction that could be fixed by a prompt/config change

Also use it proactively, with restraint, when a session reveals a repeatable
improvement opportunity. Example: if the user repeatedly asks the same agent to
follow a project-specific rule, suggest adding that rule to an agent prompt.

## What Is Possible

The roster is plain files — no plugin:

| Path | Use |
|---|---|
| `~/.pi/agent/agents/*.md` | Global agents (markdown + YAML frontmatter) |
| `.pi/agents/*.md` | Project agents; override global agents with the same name when `agentScope: both` |
| `~/.pi/agent/roster.json` | Preset table: per-agent model assignments; `/preset` switches the active one |
| `~/.pi/agent/agents/README.md` | The roster-gap protocol: when and how to create specialists |
| `~/.pi/agent/extensions/subagent/` | The delegation extension (subagent tool, `/preset`, `/new-agent`, gates, `/fix-loop`) |
| `~/.pi/agent/skills/*` | Loadable process and domain skills |
| `~/.pi/agent/prompts/*.md` | Prompt templates (`/house-*`, `/review`, ...) |

### The agent file format

```markdown
---
name: <agent-name>
description: <when to delegate — the orchestrator's routing input>
tools: <comma-separated tool allowlist>
model: <provider/model-id, optional>
---

<body: role, behavior, output contract, constraints>
```

- `tools` is enforced, not suggested: the subagent spawns with `--tools`
  (built-in AND extension/MCP tools, e.g. `web_search`). A read-only
  agent cannot write even if prompted to.
- `model` resolution order: **active preset (`roster.json`) > agent
  frontmatter > the session's model**. Omitting `model` means the agent
  inherits per-preset assignment.
- Discovery re-reads the directories on every invocation — edits apply
  without reload (only the extension itself needs `/reload`).

## Common Customizations

- **Switch presets**: `/preset <name>` (or `/preset` to list). Presets are
  budget decisions: cheap models for mechanical lanes, expensive models for
  judgment lanes.
- **Tune models**: edit the active preset in `roster.json`, or the agent's
  `model:` frontmatter as the fallback.
- **Limit costs**: use cheaper models for `explorer`, `librarian`, and
  `fixer`.
- **Improve quality**: use stronger models for `oracle`, `council`, or
  design-heavy `designer` work.
- **Control tools**: tighten or widen the `tools:` allowlist per agent.
  Read-only lanes get `read, grep, find, ls`; gates add `bash`; write lanes
  get the full built-in set. MCP tools are allowed by their prefixed names
  (e.g. `web_search`, `obsidian_search`).
- **Add custom agents**: `/new-agent` scaffolds one (scope, class, name,
  description, model). Follow the roster-gap protocol in
  `~/.pi/agent/agents/README.md`.
- **Project specialists**: `.pi/agents/` overrides global agents with the
  same name for that repo — the mechanism behind "scoped" specialists.
- **Tune prompts**: edit the agent's markdown body (role, behavior, output
  contract). Keep `description` as the when-to-delegate contract.
- **Control skills**: a subagent loads skills the same way the main session
  does; heavy process skills should be referenced in the agent prompt or
  delegated, not force-loaded.

## Delegation Anatomy

- The orchestrator (main session) delegates via the `subagent` tool —
  single, parallel (up to 8 tasks), or chain with `{previous}`.
- **Council**: dispatch 2–3 parallel subagent invocations (councillors), then
  feed the raw outputs to the `council` agent for the consensus report.
- **Gates are deterministic**: `run_runner` returns `VERDICT:
  PASSED|FAILED|BLOCKED` with evidence in `.pi/gates/`; `gh pr merge` and
  force-push are blocked without a recorded `/approve-merge`.
- **Review loop**: `/fix-loop` runs fixer → oracle → adjust → re-review
  (max 3 rounds) and writes `review.md` — the schema v4 review artifact.

## Guardrails

- Model availability is provider-dependent. If a lane's model errors (403/401),
  re-test availability (`pi --list-models`, direct `pi -p` probe) before
  re-diagnosing; switch the preset to a working model rather than deleting
  the assignment.
- Do not create overlapping agents — check the roster table in
  `~/.pi/agent/agents/README.md` first.
- New specialists follow the probation rule: start project-local, promote to
  global only after proving out in 2+ projects.
- Ask before changing prompts, tools, models, or presets; preserve existing
  values and prefer narrow, append-only edits.
- When files change, tell the user: "This applies on the next invocation;
  run /reload if you need the extension change immediately."
