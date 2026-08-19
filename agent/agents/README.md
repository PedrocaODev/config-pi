# Roster Gap Protocol

How to create a new subagent specialist when the built-in roster does not
fit. The orchestrator proposes, the human approves, `/new-agent` scaffolds.

## The roster

| Agent | Lane | Tools |
|---|---|---|
| explorer | read-only codebase recon | read, grep, find, ls |
| librarian | external research (web search, library docs, browser) | read, grep, find, ls, web_search, fetch_content, context7_* |
| oracle | architecture, review, hard debugging | read, grep, find, ls |
| council | multi-model consensus synthesis | read, grep, find, ls |
| observer | visual/image analysis | read, grep, find, ls |
| runner | **gate** — read-only verification (PASSED/FAILED/BLOCKED) | read, grep, find, ls, bash |
| integrator | **gate** — git delivery loop | read, grep, find, ls, bash |
| fixer | bounded implementation | read, write, edit, bash, grep, find, ls |
| designer | UI/UX | read, write, edit, bash, grep, find, ls |

Orchestrator (main session) never writes code; it plans, delegates,
reconciles, and verifies.

## 1. Trigger — when to create a specialist

Create a specialist when:

- a task shape recurs 2+ times across tasks, or
- a lane needs constrained tools/model the generalists lack, or
- a project has domain vocabulary worth encoding.

One-off tasks route to an existing generalist. Ceremony scales with risk —
a trivial agent is one file.

## 2. Metadata contract

Every agent is a Markdown file with YAML frontmatter:

```markdown
---
name: <agent-name>
description: <when to delegate — the orchestrator sees this in the subagent tool>
tools: <comma-separated tool allowlist>
model: <provider/model-id, optional — falls back to the active roster preset, then the session model>
---
<body: role, behavior, output contract, constraints>
```

- `description` must answer **when to delegate** (Delegate when / Don't
  delegate when) — it is the orchestrator's routing input.
- Optional `owns` / `reads` / `routing` fields may be added as prose in the
  body for self-documenting agents (the gate agents do this).
- A missing or invalid file is skipped silently by discovery — one bad file
  never breaks the roster.

## 3. Scope semantics

- **Global** (`~/.pi/agent/agents/`) — available in every project.
  "Scoped" global = constrained by frontmatter: tool-scoped or model-scoped.
- **Project** (`.pi/agents/`, nearest project root) — repo-local; loads with
  `agentScope: both` and a confirmation prompt for repo-controlled agents.
- **Override** — a project agent with the same name as a global agent
  replaces it for that project (tighter tools, project-specific prompt).
- Name-prefix conventions (`fe-*`, `db-*`) are for discoverability only —
  enforcement is via tools/model frontmatter.

## 4. Scaffolding

`/new-agent` asks scope (global/project), class (read-only/write/gate),
name, description, and model, then writes the Markdown from a template.
Agents are re-discovered on the next invocation — no reload.

## 5. Governance (probation)

- New specialists start **project-local**; promote to global only after
  proving out in **2+ projects**.
- The orchestrator proposes, the human approves, `/new-agent` scaffolds.
- Presets (`~/.pi/agent/roster.json`, `/preset`) set per-agent models as a
  budget decision — cheap models for mechanical lanes, expensive models for
  judgment lanes.
