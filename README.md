# config-pi

I designed this harness against a concrete reliability failure mode: an agent
can produce a plausible patch, skip a check, and return a confident summary
while leaving no durable record of intent, evidence, or human acceptance. This
is the failure mode I designed against, not a claim about a particular customer
incident.

That is why I treat the useful unit of agentic coding as the workflow, not the
prompt. Explicit roles constrain who plans, changes, reviews, and verifies;
durable artifacts preserve intent and evidence; deterministic gates make
required checks visible; context and memory tools carry relevant knowledge
beyond one prompt; and human acceptance keeps the final decision with a person.

This repository tracks a reusable `~/.pi` configuration for a coding-agent
harness. It is a personal reference configuration for colleagues to inspect and
adapt. It is **not** a turnkey install.

## What is here

- **`agent/agents/`** — role definitions for the agent roster, including read-only exploration (`explorer`), research (`librarian`), judgment and review (`oracle`, `council`, `observer`), gates (`runner`, `integrator`), implementation (`fixer`), and UI work (`designer`).
- **`agent/skills/`** — reusable skills and workflows, including the house-style OpenSpec workflow, issue handling, verification, Git, and project-specific integrations.
- **`agent/prompts/`** — workflow prompt templates, including the `house-*`, review, PR, and Obsidian prompts.
- **`agent/extensions/`** — Pi extensions. The tracked subagent extension provides isolated subagent contexts, streaming output, usage tracking, and project-agent trust controls. `extensions-parked/` contains extensions kept available but not active.
- **`agent/mcp.json`** — MCP server configuration. This setup includes Graphify, Obsidian second brain, Headroom, Context7, and DDG integrations; local commands and paths are environment-specific.
- **`agent/roster.json`** — roster presets that route each agent role to a model. Model names, providers, and the active preset are personal choices, not portable defaults.

The configuration also documents durable project artifacts and context tooling where the files support them. The house-style workflow keeps proposal, design, specs, tasks, plan, review, verification, and retrospective artifacts in the project. Graphify and the Obsidian second-brain integration provide persistent knowledge tooling when configured. Pi sessions, caches, and generated state remain local.

## Trust and local configuration

Inspect paths, MCP servers, plugins, providers, model names, credentials, and local integrations before use. Do not assume that a command, server, provider, model, vault, or local path exists on your machine.

User-level agents are loaded by default. Project-local agents can run with `agentScope: "project"` or `agentScope: "both"`; enable them only for repositories you trust. Interactive use can require confirmation before running repo-controlled agents. Human acceptance remains required for changes and workflow outcomes.

This repository is intentionally personal. Adapt files selectively instead of copying the configuration wholesale. Check [`.gitignore`](.gitignore) for the exact exclusions: secrets, sessions, caches, generated state, dependencies, and machine-local symlinked skills are ignored.

## House-style lifecycle

The lifecycle is exactly:

`grill → /house-new → /house-apply → /house-archive`

- **`grill`** stress-tests the idea before it becomes a proposal; skip it only for trivial, clear work.
- **`/house-new`** creates the proposal, design, specs, tasks, and plan. It plans only.
- **`/house-apply`** implements the plan through test-first slices, review loops, and verification.
- **`/house-archive`** archives the completed change after its tasks, review, verification, and retrospective are complete.

Automation supplies process and evidence. A human must still inspect the change and accept it before delivery or use.

## Inspecting and adapting

There is no automated installer. To inspect a copy:

```bash
git clone https://github.com/PedrocaODev/config-pi.git
cd config-pi
find agent -maxdepth 2 -type f | sort
```

Copy or adapt only the files you understand and need in your own `~/.pi`. Review local paths and credentials first, and verify the resulting behavior in a safe project.

For related configuration, see the companion repository: [PedrocaODev/config-opencode](https://github.com/PedrocaODev/config-opencode).

This README is a map for a deeper article series about the harness, not a promise that the setup is turnkey.
