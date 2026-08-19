/**
 * Auto-compress oversized tool results with headroom (CCR).
 *
 * Hooks pi's `tool_result` event: when a tool returns a large text result
 * (above THRESHOLD_CHARS) and the tool is not in PROTECTED_TOOLS, the result
 * is compressed via the headroom MCP server (`headroom mcp serve`) into a
 * compact schema summary with `<<ccr:hash,...>>` markers. The original stays
 * recoverable through the `ccr_retrieve` tool (headroom's SQLite persists it).
 *
 * Evidence-bearing tools (bash, read, write, edit, gate tools, subagent
 * results) are never compressed — exact output stays exact where correctness
 * depends on it.
 *
 * ponytail: single spawned headroom server, constants not config; add a
 * config file or per-tool overrides only when a real need appears.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn, type ChildProcess } from "node:child_process";
import { Type } from "typebox";

const THRESHOLD_CHARS = 30_000;
const PROTECTED_TOOLS = new Set([
	"bash",
	"read",
	"write",
	"edit",
	"grep",
	"subagent",
	"run_runner",
	"run_fix_loop",
	"ccr_retrieve",
]);

/** Tool names that must never be compressed (headroom's own surface). */
function isProtected(name: string): boolean {
	return PROTECTED_TOOLS.has(name) || /retrieve|headroom|ccr/i.test(name);
}

/* ---------- minimal JSON-RPC client for `headroom mcp serve` ---------- */

class HeadroomClient {
	private proc: ChildProcess | null = null;
	private buffer = "";
	private pending = new Map<
		number,
		{ resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }
	>();
	private nextId = 1;
	private ready: Promise<void> | null = null;

	private ensure(): Promise<void> {
		if (!this.ready) {
			this.ready = new Promise((resolve, reject) => {
				const proc = spawn("headroom", ["mcp", "serve"], {
					stdio: ["pipe", "pipe", "pipe"],
				});
				this.proc = proc;
				proc.stdout?.on("data", (d: Buffer) => this.onData(String(d)));
				proc.on("error", (e) => {
					this.failAll(e);
					reject(e);
				});
				proc.on("exit", () => this.failAll(new Error("headroom mcp server exited")));
				this.call("initialize", {
					protocolVersion: "2024-11-05",
					capabilities: {},
					clientInfo: { name: "pi-auto-compress", version: "1" },
				})
					.then(() => resolve())
					.catch(reject);
			});
		}
		return this.ready;
	}

	private onData(chunk: string): void {
		this.buffer += chunk;
		let idx: number;
		while ((idx = this.buffer.indexOf("\n")) >= 0) {
			const line = this.buffer.slice(0, idx).trim();
			this.buffer = this.buffer.slice(idx + 1);
			if (!line) continue;
			try {
				const msg = JSON.parse(line) as { id?: number; result?: unknown; error?: unknown };
				if (typeof msg.id === "number" && this.pending.has(msg.id)) {
					const p = this.pending.get(msg.id)!;
					this.pending.delete(msg.id);
					clearTimeout(p.timer);
					if (msg.error) p.reject(new Error(`headroom error: ${JSON.stringify(msg.error)}`));
					else p.resolve(msg.result);
				}
			} catch {
				/* partial line or non-JSON — ignore */
			}
		}
	}

	private call(method: string, params: Record<string, unknown>): Promise<unknown> {
		return this.ensure().then(() => {
			const id = this.nextId++;
			return new Promise<unknown>((resolve, reject) => {
				const timer = setTimeout(() => {
					this.pending.delete(id);
					reject(new Error(`headroom ${method} timed out`));
				}, 20_000);
				this.pending.set(id, { resolve, reject, timer });
				this.proc?.stdin?.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
			});
		});
	}

	private failAll(e: Error): void {
		for (const [, p] of this.pending) {
			clearTimeout(p.timer);
			p.reject(e);
		}
		this.pending.clear();
	}

	async compress(content: string): Promise<string> {
		const result = (await this.call("tools/call", {
			name: "headroom_compress",
			arguments: { content },
		})) as { content?: { type?: string; text?: string }[] };
		const text = result?.content?.[0]?.text ?? "";
		try {
			const parsed = JSON.parse(text) as { compressed?: string };
			if (typeof parsed.compressed === "string") return parsed.compressed;
		} catch {
			/* fall through to raw text */
		}
		return text;
	}

	async retrieve(hash: string): Promise<string | null> {
		const result = (await this.call("tools/call", {
			name: "headroom_retrieve",
			arguments: { hash },
		})) as { content?: { type?: string; text?: string }[] };
		const text = result?.content?.[0]?.text ?? "";
		try {
			const parsed = JSON.parse(text) as { original_content?: string };
			if (typeof parsed.original_content === "string") return parsed.original_content;
		} catch {
			/* fall through */
		}
		return text || null;
	}

	dispose(): void {
		this.proc?.kill();
		this.proc = null;
		this.ready = null;
	}
}

export default function (pi: ExtensionAPI) {
	const headroom = new HeadroomClient();

	pi.on("session_shutdown", () => headroom.dispose());

	pi.on("tool_result", async (event) => {
		if (event.isError) return;
		if (isProtected(event.toolName)) return;

		const parts = (event.content ?? []) as { type?: string; text?: string }[];
		const total = parts.reduce((n, p) => n + (typeof p.text === "string" ? p.text.length : 0), 0);
		if (total < THRESHOLD_CHARS) return;

		const text = parts.map((p) => p.text ?? "").join("\n");
		let compressed: string;
		try {
			compressed = await headroom.compress(text);
		} catch {
			return; // headroom unavailable — leave the result untouched
		}
		if (!compressed || compressed.length >= total) return;

		const hash = compressed.match(/<<ccr:([a-f0-9]+),/i)?.[1];
		const hint = hash ? ` restore with ccr_retrieve (hash=${hash})` : "";
		return {
			content: [
				{
					type: "text",
					text: `[headroom-compressed: ${total.toLocaleString()} chars → ${compressed.length.toLocaleString()}${hint}]\n\n${compressed}`,
				},
			],
		};
	});

	pi.registerTool({
		name: "ccr_retrieve",
		label: "Retrieve Original",
		description: "Restore the original, uncompressed content of a headroom-compressed tool result by its hash (from a <<ccr:hash,...>> marker).",
		parameters: Type.Object({
			hash: Type.String({ description: "The hash from the <<ccr:hash,...>> marker" }),
		}),
		async execute(_toolCallId, params) {
			try {
				const original = await headroom.retrieve(params.hash);
				if (!original) {
					return {
						content: [{ type: "text", text: `No stored content for hash ${params.hash}.` }],
						isError: true,
					};
				}
				return { content: [{ type: "text", text: original }] };
			} catch (e) {
				return {
					content: [{ type: "text", text: `ccr_retrieve failed: ${(e as Error).message}` }],
					isError: true,
				};
			}
		},
	});
}
