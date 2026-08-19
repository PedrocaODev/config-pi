# herdr shell setup (Tier 1)

herdr hosts the orchestrator. The delegation fabric stays inside pi — herdr
provides the shell, visibility, and war-room lanes.

## Prerequisites (already in place)

- herdr v0.8.0 with `default_shell = "/usr/bin/zsh"` in `~/.config/herdr/config.toml`
- `~/.pi/agent/extensions/herdr-agent-state.ts` — installed/managed by
  `herdr integration`; paints pi's `idle/working/blocked` state on pane
  borders. Do not edit it (herdr rewrites it on update).

## Recommended layout (per project)

```
workspace: <project>        herdr --session <project>
├── pane 1  pi              # the orchestrator (cd <project>; pi)
└── pane 2  shell           # scratch: git, logs, ad-hoc commands
```

- Split panes from inside herdr (`Ctrl+b %` or the herdr keybindings);
  keep the orchestrator's pane the one you focus.
- **War-room (Tier 3):** run `/house-apply` in the orchestrator pane and a
  second pi session in another pane for unrelated work — herdr keeps both
  alive and shows when each settles.
- Named sessions (`herdr --session <name>`) restore layouts per project;
  existing sessions (`moto-setup`, `try`) are unaffected.

## Notes

- Tier 2 (a herdr pane per subagent) is deliberately deferred: the subagent
  tool already streams tool calls into the TUI with structured JSON results;
  pane transcripts would be a downgrade. Revisit only if a long-running
  specialist's raw terminal is ever needed.
- `herdr agent` kinds: pi panes are detected via the integration extension,
  not a built-in agent kind — use `pane` commands for raw terminal control.
