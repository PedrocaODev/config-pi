---
name: home-environment
description: "Reference for this user's home environment and tooling — herdr (agent-aware terminal multiplexer: usage, config, shell gotcha), Gerrit/Motorola SSH config, Starship prompt config, omniroute/Gemini Code Assist setup, user-local tools (nvim, stylua, uv, graphify, gcloud, bq, gsutil), pi-node toolchain paths, and pi session transcript locations. Use when the task touches any of these tools, their configs, the user's terminal/shell setup, or PATH issues."
---

# home-environment

Reference for the user's home environment and tooling. Load-bearing shell facts (zsh default, `~/.zshenv`/`~/.bashrc` mirror) are always loaded via `~/AGENTS.md`; everything tool-specific lives here.

## herdr (agent-aware terminal multiplexer)

- Install: Homebrew (`/home/linuxbrew/.linuxbrew/bin/herdr`, v0.8.0). Rust, tmux-like, but pane-aware of AI agents (idle/working/blocked detection).
- Config: `~/.config/herdr/config.toml`; logs `~/.config/herdr/herdr*.log`; named sessions under `~/.config/herdr/sessions/<name>/`. `HERDR_CONFIG_PATH` overrides the config path.
- **Shell gotcha**: pane shell = `[terminal].default_shell` → else `$SHELL` env → else `/bin/sh`. herdr never reads /etc/passwd, so launched from a bash-originated tree (`SHELL=/bin/bash`) it spawns bash panes. `default_shell = "/usr/bin/zsh"` is set — keep it when editing config.
- `shell_mode = "auto"` → login shell on macOS, non-login on Linux: pane zsh loads `.zshenv` + `.zshrc`, not `.zprofile`.
- Usage:
  - `herdr` — launch/attach the persistent session (restores saved layout; each new pane still spawns with the current `[terminal]` config, so shell changes apply without deleting sessions).
  - `herdr --session <name>` / `herdr session attach <name>` — named sessions (in use: `moto-setup`, `try`); manage with `herdr session list|stop|delete <name>`.
  - `herdr server reload-config` — apply config.toml to a running server; `herdr server stop`; `herdr status`.
  - `herdr config check` — validate config.toml; `herdr --skill` prints herdr's own agent-driving instructions.
- Pi integration: `~/.pi/agent/extensions/herdr-agent-state.ts` is installed/managed by `herdr integration` and reports pi pane state to the herdr server over its socket. Don't edit it — herdr rewrites it on update.

## Prompt (Starship)

- Config: `~/.config/starship.toml` (Tokyo Night palette). Reload with `source ~/.zshrc` or a new terminal.
- **TOML pitfall**: top-level options (`add_newline`, `scan_timeout`) must stay **before the first `[section]` header**. Once a table header opens, every following key belongs to it — misplaced options produce `Unknown key` warnings like `Error in 'Hostname' at 'add_newline'`. `starship print-config` is the merge-verification command.

## User-local tools (`~/.local/bin`, no sudo)

- `nvim` 0.12.4 → symlink to `~/.local/nvim-linux-x86_64/bin/nvim`; LazyVim starter at `~/.config/nvim` (plugins via lazy.nvim, stylua configured in `stylua.toml`).
- `starship`, `stylua`, `gcloud` (+ `bq`, `gsutil`), `uv`, `graphify`.
- Global git editor: `nvim` (`git config --global core.editor`).

## Other toolchains

- **pi-node** at `~/.local/share/pi-node/node-v22.23.2-linux-x64/bin`: `pi`, `omniroute`, `gemini` (0.54.4).
- **Homebrew** at `/home/linuxbrew/.linuxbrew`; **cargo** env at `~/.cargo/env`.

## Gemini Code Assist / omniroute (in progress)

- `~/.gemini` holds the CLI config (`settings.json` — telemetry enabled, `.env` — quota project).
- omniroute: data in `~/.omniroute`, Docker compose in `~/omniroute-docker`, local desktop API on `localhost:20128`. Provider family `agy`/`antigravity` share one OAuth backend — a connection stored as one name is not found under the other.
- **Known blocker**: the Google account lacks `roles/serviceusage.serviceUsageConsumer` on project `moto-gemini-assist` → `403 USER_PROJECT_DENIED` from Code Assist endpoints. Re-testing before re-diagnosing is the norm; do not treat this as fixed.

## Gerrit / Motorola SSH

- Hosts: `gerrit.mot.com:29418` and `moto-git01.mot.com:29418`, user `pedropg`, configured in `~/.ssh/config`.
- Server is old **GerritCodeReview 2.14.20** (SSHD-CORE-1.4.0) → both host blocks need `HostKeyAlgorithms +ssh-rsa` **and** `PubkeyAcceptedKeyTypes +ssh-rsa`; the server only offers ssh-rsa host keys. Keep these flags.
- Identity: `~/.ssh/id_ed25519_moto` with `IdentitiesOnly yes`.
- Auth check: `ssh -T -p 29418 pedropg@gerrit.mot.com` → `Hi pedropg, you have successfully connected over SSH` = auth is fine; a clone failure after that is not a key problem.
- **`fatal: upload-pack not permitted on this server` = Gerrit project access-rights (admin-side), not SSH/key.** Don't re-debug keys when you see it — ask the repo owner to grant read access to the authenticated user.

## Pi agent

- Session transcripts: `~/.pi/agent/sessions/--home-pedrogoncalves--/*.jsonl` (JSONL; `message` records hold the conversation).
