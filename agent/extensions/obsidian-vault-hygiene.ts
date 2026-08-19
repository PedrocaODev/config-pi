/**
 * Obsidian Vault Hygiene — auto-commit the second brain while you work.
 *
 * Arms only when a vault is in play (OBSIDIAN_VAULT_PATH set, or pi is
 * running from a vault root). Commits vault changes on a timer and once
 * more at session end, so a bad rewrite is always one `git log` away.
 *
 * Mirrors the magic-context dreamer's in-session scheduling pattern:
 * timers are started in session_start and cleared in session_shutdown,
 * never from the factory.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const COMMIT_INTERVAL_MS = 20 * 60 * 1000; // every 20 minutes

function runGit(vault: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
	return new Promise((resolve) => {
		execFile("git", ["-C", vault, ...args], { timeout: 15000 }, (err, stdout, stderr) => {
			resolve({ code: err ? (err as { code?: number }).code ?? 1 : 0, stdout, stderr });
		});
	});
}

function looksLikeVault(dir: string): boolean {
	try {
		return existsSync(`${dir}/.obsidian`) && existsSync(`${dir}/.git`);
	} catch {
		return false;
	}
}

export default function (pi: ExtensionAPI) {
	let timer: NodeJS.Timeout | null = null;
	let vault: string | null = null;
	let committing = false;
	let announced = false;

	async function commitSnapshot(reason: string) {
		if (!vault || committing) return;
		committing = true;
		try {
			const add = await runGit(vault, ["add", "-A"]);
			if (add.code !== 0) return;
			// --quiet exits 1 when there are staged changes, 0 when clean
			const diff = await runGit(vault, ["diff", "--cached", "--quiet"]);
			if (diff.code !== 1) return; // nothing to commit (0) or git error
			const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
			await runGit(vault, ["commit", "-q", "-m", `auto: vault snapshot (${reason}) ${stamp}`]);
			// eslint-disable-next-line no-console
			console.log(`[vault-hygiene] committed: ${reason} ${stamp}`);
		} finally {
			committing = false;
		}
	}

	async function arm() {
		const envVault = process.env.OBSIDIAN_VAULT_PATH;
		const cwd = process.cwd();
		const candidate = envVault && looksLikeVault(envVault) ? envVault : looksLikeVault(cwd) ? cwd : null;
		if (!candidate) return; // no vault in play — stay inert

		vault = candidate;
		if (timer) clearInterval(timer);
		timer = setInterval(() => void commitSnapshot("interval"), COMMIT_INTERVAL_MS);

		if (!announced && pi.ui) {
			pi.ui.notify(`Vault hygiene armed: auto-committing ${vault}`, "info");
			announced = true;
		}

		// capture any uncommitted state from before this session
		void commitSnapshot("session start");
	}

	pi.on("session_start", () => {
		void arm();
	});

	pi.on("session_shutdown", () => {
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
		void commitSnapshot("session end");
		vault = null;
	});
}
