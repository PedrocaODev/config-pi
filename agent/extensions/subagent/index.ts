/**
 * Subagent Tool - Delegate tasks to specialized agents
 *
 * Spawns a separate `pi` process for each subagent invocation,
 * giving it an isolated context window.
 *
 * Supports three modes:
 *   - Single: { agent: "name", task: "..." }
 *   - Parallel: { tasks: [{ agent: "name", task: "..." }, ...] }
 *   - Chain: { chain: [{ agent: "name", task: "... {previous} ..." }, ...] }
 *
 * Uses JSON mode to capture structured output from subagents.
 */

import { execFile, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentToolResult, ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Message } from "@earendil-works/pi-ai";
import { StringEnum } from "@earendil-works/pi-ai";
import {
	CONFIG_DIR_NAME,
	type ExtensionAPI,
	getAgentDir,
	getMarkdownTheme,
	isToolCallEventType,
	withFileMutationQueue,
} from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { type AgentConfig, type AgentScope, discoverAgents } from "./agents.ts";

const MAX_PARALLEL_TASKS = 8;
const MAX_CONCURRENCY = 4;
const COLLAPSED_ITEM_COUNT = 10;
const PER_TASK_OUTPUT_CAP = 50 * 1024;

function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	return `${(count / 1000000).toFixed(1)}M`;
}

function formatUsageStats(
	usage: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		cost: number;
		contextTokens?: number;
		turns?: number;
	},
	model?: string,
): string {
	const parts: string[] = [];
	if (usage.turns) parts.push(`${usage.turns} turn${usage.turns > 1 ? "s" : ""}`);
	if (usage.input) parts.push(`↑${formatTokens(usage.input)}`);
	if (usage.output) parts.push(`↓${formatTokens(usage.output)}`);
	if (usage.cacheRead) parts.push(`R${formatTokens(usage.cacheRead)}`);
	if (usage.cacheWrite) parts.push(`W${formatTokens(usage.cacheWrite)}`);
	if (usage.cost) parts.push(`$${usage.cost.toFixed(4)}`);
	if (usage.contextTokens && usage.contextTokens > 0) {
		parts.push(`ctx:${formatTokens(usage.contextTokens)}`);
	}
	if (model) parts.push(model);
	return parts.join(" ");
}

function formatToolCall(
	toolName: string,
	args: Record<string, unknown>,
	themeFg: (color: any, text: string) => string,
): string {
	const shortenPath = (p: string) => {
		const home = os.homedir();
		return p.startsWith(home) ? `~${p.slice(home.length)}` : p;
	};

	switch (toolName) {
		case "bash": {
			const command = (args.command as string) || "...";
			const preview = command.length > 60 ? `${command.slice(0, 60)}...` : command;
			return themeFg("muted", "$ ") + themeFg("toolOutput", preview);
		}
		case "read": {
			const rawPath = (args.file_path || args.path || "...") as string;
			const filePath = shortenPath(rawPath);
			const offset = args.offset as number | undefined;
			const limit = args.limit as number | undefined;
			let text = themeFg("accent", filePath);
			if (offset !== undefined || limit !== undefined) {
				const startLine = offset ?? 1;
				const endLine = limit !== undefined ? startLine + limit - 1 : "";
				text += themeFg("warning", `:${startLine}${endLine ? `-${endLine}` : ""}`);
			}
			return themeFg("muted", "read ") + text;
		}
		case "write": {
			const rawPath = (args.file_path || args.path || "...") as string;
			const filePath = shortenPath(rawPath);
			const content = (args.content || "") as string;
			const lines = content.split("\n").length;
			let text = themeFg("muted", "write ") + themeFg("accent", filePath);
			if (lines > 1) text += themeFg("dim", ` (${lines} lines)`);
			return text;
		}
		case "edit": {
			const rawPath = (args.file_path || args.path || "...") as string;
			return themeFg("muted", "edit ") + themeFg("accent", shortenPath(rawPath));
		}
		case "ls": {
			const rawPath = (args.path || ".") as string;
			return themeFg("muted", "ls ") + themeFg("accent", shortenPath(rawPath));
		}
		case "find": {
			const pattern = (args.pattern || "*") as string;
			const rawPath = (args.path || ".") as string;
			return themeFg("muted", "find ") + themeFg("accent", pattern) + themeFg("dim", ` in ${shortenPath(rawPath)}`);
		}
		case "grep": {
			const pattern = (args.pattern || "") as string;
			const rawPath = (args.path || ".") as string;
			return (
				themeFg("muted", "grep ") +
				themeFg("accent", `/${pattern}/`) +
				themeFg("dim", ` in ${shortenPath(rawPath)}`)
			);
		}
		default: {
			const argsStr = JSON.stringify(args);
			const preview = argsStr.length > 50 ? `${argsStr.slice(0, 50)}...` : argsStr;
			return themeFg("accent", toolName) + themeFg("dim", ` ${preview}`);
		}
	}
}

interface Roster {
	activePreset: string | null;
	presets: Record<string, Record<string, string>>;
}

function loadRoster(): Roster {
	try {
		const raw = fs.readFileSync(path.join(getAgentDir(), "roster.json"), "utf-8");
		const parsed = JSON.parse(raw);
		return {
			activePreset: typeof parsed.activePreset === "string" ? parsed.activePreset : null,
			presets: parsed.presets && typeof parsed.presets === "object" ? parsed.presets : {},
		};
	} catch {
		return { activePreset: null, presets: {} };
	}
}

interface UsageStats {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	contextTokens: number;
	turns: number;
}

interface SingleResult {
	agent: string;
	agentSource: "user" | "project" | "unknown";
	task: string;
	exitCode: number;
	messages: Message[];
	stderr: string;
	usage: UsageStats;
	model?: string;
	stopReason?: string;
	errorMessage?: string;
	step?: number;
}

interface SubagentDetails {
	mode: "single" | "parallel" | "chain";
	agentScope: AgentScope;
	projectAgentsDir: string | null;
	results: SingleResult[];
}

function getFinalOutput(messages: Message[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg.role === "assistant") {
			for (const part of msg.content) {
				if (part.type === "text") return part.text;
			}
		}
	}
	return "";
}

function isFailedResult(result: SingleResult): boolean {
	return result.exitCode !== 0 || result.stopReason === "error" || result.stopReason === "aborted";
}

function getResultOutput(result: SingleResult): string {
	if (isFailedResult(result)) {
		return result.errorMessage || result.stderr || getFinalOutput(result.messages) || "(no output)";
	}
	return getFinalOutput(result.messages) || "(no output)";
}

function truncateParallelOutput(output: string): string {
	const byteLength = Buffer.byteLength(output, "utf8");
	if (byteLength <= PER_TASK_OUTPUT_CAP) return output;

	let truncated = output.slice(0, PER_TASK_OUTPUT_CAP);
	while (Buffer.byteLength(truncated, "utf8") > PER_TASK_OUTPUT_CAP) {
		truncated = truncated.slice(0, -1);
	}
	return `${truncated}\n\n[Output truncated: ${byteLength - Buffer.byteLength(truncated, "utf8")} bytes omitted. Full output preserved in tool details.]`;
}

type DisplayItem = { type: "text"; text: string } | { type: "toolCall"; name: string; args: Record<string, any> };

function getDisplayItems(messages: Message[]): DisplayItem[] {
	const items: DisplayItem[] = [];
	for (const msg of messages) {
		if (msg.role === "assistant") {
			for (const part of msg.content) {
				if (part.type === "text") items.push({ type: "text", text: part.text });
				else if (part.type === "toolCall") items.push({ type: "toolCall", name: part.name, args: part.arguments });
			}
		}
	}
	return items;
}

async function mapWithConcurrencyLimit<TIn, TOut>(
	items: TIn[],
	concurrency: number,
	fn: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
	if (items.length === 0) return [];
	const limit = Math.max(1, Math.min(concurrency, items.length));
	const results: TOut[] = new Array(items.length);
	let nextIndex = 0;
	const workers = new Array(limit).fill(null).map(async () => {
		while (true) {
			const current = nextIndex++;
			if (current >= items.length) return;
			results[current] = await fn(items[current], current);
		}
	});
	await Promise.all(workers);
	return results;
}

async function writePromptToTempFile(agentName: string, prompt: string): Promise<{ dir: string; filePath: string }> {
	const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-subagent-"));
	const safeName = agentName.replace(/[^\w.-]+/g, "_");
	const filePath = path.join(tmpDir, `prompt-${safeName}.md`);
	await withFileMutationQueue(filePath, async () => {
		await fs.promises.writeFile(filePath, prompt, { encoding: "utf-8", mode: 0o600 });
	});
	return { dir: tmpDir, filePath };
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
	const currentScript = process.argv[1];
	const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
	if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
		return { command: process.execPath, args: [currentScript, ...args] };
	}

	const execName = path.basename(process.execPath).toLowerCase();
	const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
	if (!isGenericRuntime) {
		return { command: process.execPath, args };
	}

	return { command: "pi", args };
}

type OnUpdateCallback = (partial: AgentToolResult<SubagentDetails>) => void;

interface DispatchDefaults {
	model?: string;
	thinkingLevel?: ThinkingLevel;
	presetModels?: Record<string, string>;
}

async function runSingleAgent(
	defaultCwd: string,
	dispatchDefaults: DispatchDefaults,
	agents: AgentConfig[],
	agentName: string,
	task: string,
	cwd: string | undefined,
	step: number | undefined,
	signal: AbortSignal | undefined,
	onUpdate: OnUpdateCallback | undefined,
	makeDetails: (results: SingleResult[]) => SubagentDetails,
): Promise<SingleResult> {
	const agent = agents.find((a) => a.name === agentName);

	if (!agent) {
		const available = agents.map((a) => `"${a.name}"`).join(", ") || "none";
		return {
			agent: agentName,
			agentSource: "unknown",
			task,
			exitCode: 1,
			messages: [],
			stderr: `Unknown agent: "${agentName}". Available agents: ${available}.`,
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
			step,
		};
	}

	const args: string[] = ["--mode", "json", "-p", "--no-session"];
	const inheritsDispatchConfig = !agent.model;
	// Preset model (roster.json) > agent frontmatter model > dispatch default.
	const model =
		dispatchDefaults.presetModels?.[agent.name] ?? agent.model ?? dispatchDefaults.model;
	if (model) args.push("--model", model);
	if (inheritsDispatchConfig && dispatchDefaults.thinkingLevel) {
		args.push("--thinking", dispatchDefaults.thinkingLevel);
	}
	if (agent.tools && agent.tools.length > 0) args.push("--tools", agent.tools.join(","));

	let tmpPromptDir: string | null = null;
	let tmpPromptPath: string | null = null;

	const currentResult: SingleResult = {
		agent: agentName,
		agentSource: agent.source,
		task,
		exitCode: 0,
		messages: [],
		stderr: "",
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
		model,
		step,
	};

	const emitUpdate = () => {
		if (onUpdate) {
			onUpdate({
				content: [{ type: "text", text: getFinalOutput(currentResult.messages) || "(running...)" }],
				details: makeDetails([currentResult]),
			});
		}
	};

	try {
		if (agent.systemPrompt.trim()) {
			const tmp = await writePromptToTempFile(agent.name, agent.systemPrompt);
			tmpPromptDir = tmp.dir;
			tmpPromptPath = tmp.filePath;
			args.push("--append-system-prompt", tmpPromptPath);
		}

		args.push(`Task: ${task}`);
		let wasAborted = false;

		const exitCode = await new Promise<number>((resolve) => {
			const invocation = getPiInvocation(args);
			const proc = spawn(invocation.command, invocation.args, {
				cwd: cwd ?? defaultCwd,
				shell: false,
				stdio: ["ignore", "pipe", "pipe"],
				env: { ...process.env, PI_SUBAGENT_CHILD: "1" },
			});
			let buffer = "";

			const processLine = (line: string) => {
				if (!line.trim()) return;
				let event: any;
				try {
					event = JSON.parse(line);
				} catch {
					return;
				}

				if (event.type === "message_end" && event.message) {
					const msg = event.message as Message;
					currentResult.messages.push(msg);

					if (msg.role === "assistant") {
						currentResult.usage.turns++;
						const usage = msg.usage;
						if (usage) {
							currentResult.usage.input += usage.input || 0;
							currentResult.usage.output += usage.output || 0;
							currentResult.usage.cacheRead += usage.cacheRead || 0;
							currentResult.usage.cacheWrite += usage.cacheWrite || 0;
							currentResult.usage.cost += usage.cost?.total || 0;
							currentResult.usage.contextTokens = usage.totalTokens || 0;
						}
						if (!currentResult.model && msg.model) currentResult.model = msg.model;
						if (msg.stopReason) currentResult.stopReason = msg.stopReason;
						if (msg.errorMessage) currentResult.errorMessage = msg.errorMessage;
					}
					emitUpdate();
				}

				if (event.type === "tool_result_end" && event.message) {
					currentResult.messages.push(event.message as Message);
					emitUpdate();
				}
			};

			proc.stdout.on("data", (data) => {
				buffer += data.toString();
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";
				for (const line of lines) processLine(line);
			});

			proc.stderr.on("data", (data) => {
				currentResult.stderr += data.toString();
			});

			proc.on("close", (code) => {
				if (buffer.trim()) processLine(buffer);
				resolve(code ?? 0);
			});

			proc.on("error", () => {
				resolve(1);
			});

			if (signal) {
				const killProc = () => {
					wasAborted = true;
					proc.kill("SIGTERM");
					setTimeout(() => {
						if (!proc.killed) proc.kill("SIGKILL");
					}, 5000);
				};
				if (signal.aborted) killProc();
				else signal.addEventListener("abort", killProc, { once: true });
			}
		});

		currentResult.exitCode = exitCode;
		if (wasAborted) throw new Error("Subagent was aborted");
		return currentResult;
	} finally {
		if (tmpPromptPath)
			try {
				fs.unlinkSync(tmpPromptPath);
			} catch {
				/* ignore */
			}
		if (tmpPromptDir)
			try {
				fs.rmdirSync(tmpPromptDir);
			} catch {
				/* ignore */
			}
	}
}

const TaskItem = Type.Object({
	agent: Type.String({ description: "Name of the agent to invoke" }),
	task: Type.String({ description: "Task to delegate to the agent" }),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
});

const ChainItem = Type.Object({
	agent: Type.String({ description: "Name of the agent to invoke" }),
	task: Type.String({ description: "Task with optional {previous} placeholder for prior output" }),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
});

const AgentScopeSchema = StringEnum(["user", "project", "both"] as const, {
	description:
		'Which agent directories to use. Default: "both". "both" includes project-local agents (.pi/agents) which override global agents with the same name.',
	default: "both",
});

const SubagentParams = Type.Object({
	agent: Type.Optional(Type.String({ description: "Name of the agent to invoke (for single mode)" })),
	task: Type.Optional(Type.String({ description: "Task to delegate (for single mode)" })),
	tasks: Type.Optional(Type.Array(TaskItem, { description: "Array of {agent, task} for parallel execution" })),
	chain: Type.Optional(Type.Array(ChainItem, { description: "Array of {agent, task} for sequential execution" })),
	agentScope: Type.Optional(AgentScopeSchema),
	confirmProjectAgents: Type.Optional(
		Type.Boolean({ description: "Prompt before running project-local agents. Default: true.", default: true }),
	),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process (single mode)" })),
});

function parseRunnerVerdict(output: string, exitCode: number): "PASSED" | "FAILED" | "BLOCKED" | "UNKNOWN" {
	if (exitCode !== 0) return "FAILED";
	const hasFailed = /RESULT:\s*FAILED/.test(output);
	const hasBlocked = /RESULT:\s*BLOCKED/.test(output);
	const hasPassed = /RESULT:\s*PASSED/.test(output);
	if (hasFailed) return "FAILED";
	if (hasBlocked) return "BLOCKED";
	if (hasPassed) return "PASSED";
	return "UNKNOWN";
}

function gatesDirFor(cwd: string): string {
	return path.join(cwd, CONFIG_DIR_NAME, "gates");
}

async function recordRunnerEvidence(cwd: string, record: Record<string, unknown>): Promise<string> {
	const dir = gatesDirFor(cwd);
	await fs.promises.mkdir(dir, { recursive: true });
	const lastPath = path.join(dir, "runner-last.json");
	const stampPath = path.join(dir, `runner-${Date.now()}.json`);
	const json = JSON.stringify(record, null, 2) + "\n";
	await withFileMutationQueue(lastPath, async () => {
		await fs.promises.writeFile(lastPath, json, "utf-8");
	});
	await fs.promises.writeFile(stampPath, json, "utf-8");
	return lastPath;
}

function extractPrNumber(command: string): string | null {
	const numbered = command.match(/gh\s+pr\s+merge\s+(\d+)/);
	if (numbered) return numbered[1];
	const fromUrl = command.match(/pull\/(\d+)/);
	if (fromUrl) return fromUrl[1];
	return null;
}

async function readMergeApprovals(cwd: string): Promise<Record<string, { approvedAt: number }>> {
	try {
		const raw = await fs.promises.readFile(path.join(gatesDirFor(cwd), "merge-approvals.json"), "utf-8");
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

async function writeMergeApprovals(cwd: string, approvals: Record<string, { approvedAt: number }>): Promise<void> {
	const dir = gatesDirFor(cwd);
	await fs.promises.mkdir(dir, { recursive: true });
	await withFileMutationQueue(path.join(dir, "merge-approvals.json"), async () => {
		await fs.promises.writeFile(path.join(dir, "merge-approvals.json"), JSON.stringify(approvals, null, 2) + "\n", "utf-8");
	});
}

const RunnerParams = Type.Object({
	task: Type.String({ description: "Verification task: the check command or scope to run (e.g. 'npm test', or 'run the plan's final verification')" }),
	cwd: Type.Optional(Type.String({ description: "Working directory for the runner process" })),
});

function execGit(cwd: string, args: string[]): Promise<{ stdout: string; code: number }> {
	return new Promise((resolve) => {
		execFile("git", args, { cwd, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
			resolve({ stdout: String(stdout), code: err ? (err as NodeJS.ErrnoException).code ?? 1 : 0 });
		});
	});
}

function extractJsonArray(text: string): string | null {
	const start = text.indexOf("[");
	if (start === -1) return null;
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let i = start; i < text.length; i++) {
		const ch = text[i];
		if (inString) {
			if (escaped) escaped = false;
			else if (ch === "\\") escaped = true;
			else if (ch === '"') inString = false;
			continue;
		}
		if (ch === '"') inString = true;
		else if (ch === "[") depth++;
		else if (ch === "]") {
			depth--;
			if (depth === 0) return text.slice(start, i + 1);
		}
	}
	return null;
}

function parseFindings(output: string): unknown[] | null {
	const fence = output.match(/```(?:json)?\s*([\s\S]*?)```/);
	const candidates = [fence?.[1], extractJsonArray(output), output];
	for (const c of candidates) {
		if (!c) continue;
		try {
			const parsed = JSON.parse(c.trim());
			if (Array.isArray(parsed)) return parsed;
		} catch {
			/* try next candidate */
		}
	}
	return null;
}

async function findActiveChange(cwd: string): Promise<{ name: string; dir: string; planPath: string | null } | null> {
	const changesDir = path.join(cwd, "openspec", "changes");
	if (!fs.existsSync(changesDir)) return null;
	let entries: fs.Dirent[];
	try {
		entries = await fs.promises.readdir(changesDir, { withFileTypes: true });
	} catch {
		return null;
	}
	let best: string | null = null;
	let bestTime = 0;
	for (const e of entries) {
		if (!e.isDirectory() || e.name === "archive") continue;
		const planPath = path.join(changesDir, e.name, "plan.md");
		try {
			const st = fs.statSync(planPath);
			if (st.mtimeMs > bestTime) {
				bestTime = st.mtimeMs;
				best = e.name;
			}
		} catch {
			/* no plan.md — not apply-ready */
		}
	}
	if (!best) return null;
	return { name: best, dir: path.join(changesDir, best), planPath: path.join(changesDir, best, "plan.md") };
}

interface FixLoopOptions {
	task: string;
	cwd: string;
}

interface FixLoopResult {
	verdict: "PASSED" | "BLOCKED";
	reviewPath: string | null;
	findings: unknown[];
	iterationLog: string[];
	baseline: string;
}

async function runFixLoop(
	dispatchDefaults: DispatchDefaults,
	agents: AgentConfig[],
	projectAgentsDir: string | null,
	signal: AbortSignal | undefined,
	opts: FixLoopOptions,
): Promise<FixLoopResult> {
	const MAX_ROUNDS = 3;
	const makeDetails = (results: SingleResult[]): SubagentDetails => ({
		mode: "single",
		agentScope: "both",
		projectAgentsDir,
		results,
	});

	const { stdout: baselineHead } = await execGit(opts.cwd, ["rev-parse", "HEAD"]);
	const baseline = baselineHead.trim() || "HEAD";

	const change = await findActiveChange(opts.cwd);
	const planCtx = change?.planPath ? `Read the plan at ${change.planPath} first. ` : "";
	const scope = opts.task.trim() ? ` Task scope: ${opts.task.trim()}` : "";

	// Round 1: fixer implements per plan.
	await runSingleAgent(opts.cwd, dispatchDefaults, agents, "fixer", `${planCtx}Implement according to the plan.${scope}`, undefined, 1, signal, undefined, makeDetails);

	const iterationLog: string[] = [];
	let finalFindings: unknown[] = [];
	let verdict: "PASSED" | "BLOCKED" = "BLOCKED";

	for (let round = 1; round <= MAX_ROUNDS; round++) {
		const { stdout: diff } = await execGit(opts.cwd, ["diff", baseline]);
		const priorFindingsText =
			finalFindings.length > 0 ? `\nPrior findings to verify (mark each fixed only if genuinely resolved): ${JSON.stringify(finalFindings)}\n` : "";
		const reviewTask = `${planCtx}Review the implementation of this plan. Here is the cumulative diff since the baseline:\n\n${diff || "(no diff)"}\n${priorFindingsText}\nReport NEW findings too. Emit your findings per your contract.`;
		const oracleResult = await runSingleAgent(opts.cwd, dispatchDefaults, agents, "oracle", reviewTask, undefined, round, signal, undefined, makeDetails);
		const oracleOutput = getFinalOutput(oracleResult.messages) || oracleResult.stderr || "";

		if (isFailedResult(oracleResult)) {
			verdict = "BLOCKED";
			iterationLog.push(`Round ${round}: oracle subagent failed (${oracleResult.stopReason ?? "error"}): ${oracleResult.errorMessage || oracleResult.stderr || "no output"}`);
			break;
		}

		const findings = parseFindings(oracleOutput);
		if (!findings) {
			verdict = "BLOCKED";
			iterationLog.push(`Round ${round}: oracle contract violation — findings JSON not parseable.`);
			break;
		}
		finalFindings = findings;
		const blockingOpen = findings.filter((f: any) => f?.severity === "blocking" && f?.status === "open");
		iterationLog.push(`Round ${round}: ${findings.length} findings (${blockingOpen.length} blocking open).`);

		if (blockingOpen.length === 0) {
			verdict = "PASSED";
			break;
		}
		if (round === MAX_ROUNDS) {
			iterationLog.push(
				`Round ${round}: round cap reached with ${blockingOpen.length} blocking open findings remaining — human waiver decision required.`,
			);
			break;
		}

		const fixTask = `Address these review findings with the smallest safe changes. Do not broaden scope.\n\nFindings: ${JSON.stringify(findings, null, 2)}\n\n${planCtx}${scope}`;
		await runSingleAgent(opts.cwd, dispatchDefaults, agents, "fixer", fixTask, undefined, round, signal, undefined, makeDetails);
	}

	return { verdict, reviewPath: change ? path.join(change.dir, "review.md") : null, findings: finalFindings, iterationLog, baseline };
}

async function writeReviewArtifact(result: FixLoopResult, cwd: string): Promise<string> {
	const target = result.reviewPath ?? path.join(cwd, CONFIG_DIR_NAME, "fix-loop", "review.md");
	await fs.promises.mkdir(path.dirname(target), { recursive: true });

	const findingsMd = result.findings.length
		? result.findings
				.map((f: any, i: number) => {
					const id = f?.id ?? `F-${i + 1}`;
					return [
						`#### Finding: ${id}`,
						"",
						`- **ID:** ${id}`,
						`- **Severity:** ${f?.severity ?? "non-blocking"}`,
						`- **Location:** ${f?.location ?? "unavailable"}`,
						`- **Summary:** ${f?.summary ?? ""}`,
						`- **Status:** ${f?.status ?? "open"}`,
						`- **Resolution:** ${f?.resolution ?? ""}`,
						"",
					].join("\n");
				})
				.join("\n")
		: "No findings.";

	const md = [
		"## Review record",
		"",
		"### Verdict",
		"",
		`- **Verdict:** ${result.verdict}`,
		`- **Rounds:** ${result.iterationLog.length}`,
		"- **Reviewed by:** oracle subagent",
		"",
		"### Findings",
		"",
		findingsMd,
		"",
		"### Iteration log",
		"",
		...result.iterationLog.map((l) => `- ${l}`),
		"",
	].join("\n");

	await withFileMutationQueue(target, async () => {
		await fs.promises.writeFile(target, md, "utf-8");
	});
	return target;
}

export default function (pi: ExtensionAPI) {
	// Recursion guard: subagent children must not expose the subagent tool
	// (they would otherwise inherit this extension and could spawn nested
	// subagents). Other extensions still load normally in children.
	if (process.env.PI_SUBAGENT_CHILD === "1") return;

	pi.registerTool({
		name: "subagent",
		label: "Subagent",
		description: [
			"Delegate tasks to specialized subagents with isolated context.",
			"Modes: single (agent + task), parallel (tasks array), chain (sequential with {previous} placeholder).",
			`Default agent scope is "both" (global agents from ${path.join(getAgentDir(), "agents")} plus project agents from ${CONFIG_DIR_NAME}/agents, which override global ones).`,
		].join(" "),
		parameters: SubagentParams,

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const agentScope: AgentScope = params.agentScope ?? "both";
			const roster = loadRoster();
			const dispatchDefaults: DispatchDefaults = {
				model: ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined,
				thinkingLevel: ctx.thinkingLevel,
				presetModels: roster.activePreset ? roster.presets[roster.activePreset] : undefined,
			};
			const discovery = discoverAgents(ctx.cwd, agentScope);
			const agents = discovery.agents;
			const confirmProjectAgents = params.confirmProjectAgents ?? true;

			const hasChain = (params.chain?.length ?? 0) > 0;
			const hasTasks = (params.tasks?.length ?? 0) > 0;
			const hasSingle = Boolean(params.agent && params.task);
			const modeCount = Number(hasChain) + Number(hasTasks) + Number(hasSingle);

			const makeDetails =
				(mode: "single" | "parallel" | "chain") =>
				(results: SingleResult[]): SubagentDetails => ({
					mode,
					agentScope,
					projectAgentsDir: discovery.projectAgentsDir,
					results,
				});

			if (modeCount !== 1) {
				const available = agents.map((a) => `${a.name} (${a.source})`).join(", ") || "none";
				return {
					content: [
						{
							type: "text",
							text: `Invalid parameters. Provide exactly one mode.\nAvailable agents: ${available}`,
						},
					],
					details: makeDetails("single")([]),
				};
			}

			if ((agentScope === "project" || agentScope === "both") && confirmProjectAgents && ctx.hasUI) {
				const requestedAgentNames = new Set<string>();
				if (params.chain) for (const step of params.chain) requestedAgentNames.add(step.agent);
				if (params.tasks) for (const t of params.tasks) requestedAgentNames.add(t.agent);
				if (params.agent) requestedAgentNames.add(params.agent);

				const projectAgentsRequested = Array.from(requestedAgentNames)
					.map((name) => agents.find((a) => a.name === name))
					.filter((a): a is AgentConfig => a?.source === "project");

				if (projectAgentsRequested.length > 0) {
					const names = projectAgentsRequested.map((a) => a.name).join(", ");
					const dir = discovery.projectAgentsDir ?? "(unknown)";
					const ok = await ctx.ui.confirm(
						"Run project-local agents?",
						`Agents: ${names}\nSource: ${dir}\n\nProject agents are repo-controlled. Only continue for trusted repositories.`,
					);
					if (!ok)
						return {
							content: [{ type: "text", text: "Canceled: project-local agents not approved." }],
							details: makeDetails(hasChain ? "chain" : hasTasks ? "parallel" : "single")([]),
						};
				}
			}

			if (params.chain && params.chain.length > 0) {
				const results: SingleResult[] = [];
				let previousOutput = "";

				for (let i = 0; i < params.chain.length; i++) {
					const step = params.chain[i];
					const taskWithContext = step.task.replace(/\{previous\}/g, previousOutput);

					// Create update callback that includes all previous results
					const chainUpdate: OnUpdateCallback | undefined = onUpdate
						? (partial) => {
								// Combine completed results with current streaming result
								const currentResult = partial.details?.results[0];
								if (currentResult) {
									const allResults = [...results, currentResult];
									onUpdate({
										content: partial.content,
										details: makeDetails("chain")(allResults),
									});
								}
							}
						: undefined;

					const result = await runSingleAgent(
						ctx.cwd,
						dispatchDefaults,
						agents,
						step.agent,
						taskWithContext,
						step.cwd,
						i + 1,
						signal,
						chainUpdate,
						makeDetails("chain"),
					);
					results.push(result);

					const isError = isFailedResult(result);
					if (isError) {
						const errorMsg = getResultOutput(result);
						return {
							content: [{ type: "text", text: `Chain stopped at step ${i + 1} (${step.agent}): ${errorMsg}` }],
							details: makeDetails("chain")(results),
							isError: true,
						};
					}
					previousOutput = getFinalOutput(result.messages);
				}
				return {
					content: [{ type: "text", text: getFinalOutput(results[results.length - 1].messages) || "(no output)" }],
					details: makeDetails("chain")(results),
				};
			}

			if (params.tasks && params.tasks.length > 0) {
				if (params.tasks.length > MAX_PARALLEL_TASKS)
					return {
						content: [
							{
								type: "text",
								text: `Too many parallel tasks (${params.tasks.length}). Max is ${MAX_PARALLEL_TASKS}.`,
							},
						],
						details: makeDetails("parallel")([]),
					};

				// Track all results for streaming updates
				const allResults: SingleResult[] = new Array(params.tasks.length);

				// Initialize placeholder results
				for (let i = 0; i < params.tasks.length; i++) {
					allResults[i] = {
						agent: params.tasks[i].agent,
						agentSource: "unknown",
						task: params.tasks[i].task,
						exitCode: -1, // -1 = still running
						messages: [],
						stderr: "",
						usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
					};
				}

				const emitParallelUpdate = () => {
					if (onUpdate) {
						const running = allResults.filter((r) => r.exitCode === -1).length;
						const done = allResults.filter((r) => r.exitCode !== -1).length;
						onUpdate({
							content: [
								{ type: "text", text: `Parallel: ${done}/${allResults.length} done, ${running} running...` },
							],
							details: makeDetails("parallel")([...allResults]),
						});
					}
				};

				const results = await mapWithConcurrencyLimit(params.tasks, MAX_CONCURRENCY, async (t, index) => {
					const result = await runSingleAgent(
						ctx.cwd,
						dispatchDefaults,
						agents,
						t.agent,
						t.task,
						t.cwd,
						undefined,
						signal,
						// Per-task update callback
						(partial) => {
							if (partial.details?.results[0]) {
								allResults[index] = partial.details.results[0];
								emitParallelUpdate();
							}
						},
						makeDetails("parallel"),
					);
					allResults[index] = result;
					emitParallelUpdate();
					return result;
				});

				const successCount = results.filter((r) => !isFailedResult(r)).length;
				const summaries = results.map((r) => {
					const output = truncateParallelOutput(getResultOutput(r));
					const status = isFailedResult(r)
						? `failed${r.stopReason && r.stopReason !== "end" ? ` (${r.stopReason})` : ""}`
						: "completed";
					return `### [${r.agent}] ${status}\n\n${output}`;
				});
				return {
					content: [
						{
							type: "text",
							text: `Parallel: ${successCount}/${results.length} succeeded\n\n${summaries.join("\n\n---\n\n")}`,
						},
					],
					details: makeDetails("parallel")(results),
				};
			}

			if (params.agent && params.task) {
				const result = await runSingleAgent(
					ctx.cwd,
					dispatchDefaults,
					agents,
					params.agent,
					params.task,
					params.cwd,
					undefined,
					signal,
					onUpdate,
					makeDetails("single"),
				);
				const isError = isFailedResult(result);
				if (isError) {
					const errorMsg = getResultOutput(result);
					return {
						content: [{ type: "text", text: `Agent ${result.stopReason || "failed"}: ${errorMsg}` }],
						details: makeDetails("single")([result]),
						isError: true,
					};
				}
				return {
					content: [{ type: "text", text: getFinalOutput(result.messages) || "(no output)" }],
					details: makeDetails("single")([result]),
				};
			}

			const available = agents.map((a) => `${a.name} (${a.source})`).join(", ") || "none";
			return {
				content: [{ type: "text", text: `Invalid parameters. Available agents: ${available}` }],
				details: makeDetails("single")([]),
			};
		},

		renderCall(args, theme, _context) {
			const scope: AgentScope = args.agentScope ?? "user";
			if (args.chain && args.chain.length > 0) {
				let text =
					theme.fg("toolTitle", theme.bold("subagent ")) +
					theme.fg("accent", `chain (${args.chain.length} steps)`) +
					theme.fg("muted", ` [${scope}]`);
				for (let i = 0; i < Math.min(args.chain.length, 3); i++) {
					const step = args.chain[i];
					// Clean up {previous} placeholder for display
					const cleanTask = step.task.replace(/\{previous\}/g, "").trim();
					const preview = cleanTask.length > 40 ? `${cleanTask.slice(0, 40)}...` : cleanTask;
					text +=
						"\n  " +
						theme.fg("muted", `${i + 1}.`) +
						" " +
						theme.fg("accent", step.agent) +
						theme.fg("dim", ` ${preview}`);
				}
				if (args.chain.length > 3) text += `\n  ${theme.fg("muted", `... +${args.chain.length - 3} more`)}`;
				return new Text(text, 0, 0);
			}
			if (args.tasks && args.tasks.length > 0) {
				let text =
					theme.fg("toolTitle", theme.bold("subagent ")) +
					theme.fg("accent", `parallel (${args.tasks.length} tasks)`) +
					theme.fg("muted", ` [${scope}]`);
				for (const t of args.tasks.slice(0, 3)) {
					const preview = t.task.length > 40 ? `${t.task.slice(0, 40)}...` : t.task;
					text += `\n  ${theme.fg("accent", t.agent)}${theme.fg("dim", ` ${preview}`)}`;
				}
				if (args.tasks.length > 3) text += `\n  ${theme.fg("muted", `... +${args.tasks.length - 3} more`)}`;
				return new Text(text, 0, 0);
			}
			const agentName = args.agent || "...";
			const preview = args.task ? (args.task.length > 60 ? `${args.task.slice(0, 60)}...` : args.task) : "...";
			let text =
				theme.fg("toolTitle", theme.bold("subagent ")) +
				theme.fg("accent", agentName) +
				theme.fg("muted", ` [${scope}]`);
			text += `\n  ${theme.fg("dim", preview)}`;
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded }, theme, _context) {
			const details = result.details as SubagentDetails | undefined;
			if (!details || details.results.length === 0) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
			}

			const mdTheme = getMarkdownTheme();

			const renderDisplayItems = (items: DisplayItem[], limit?: number) => {
				const toShow = limit ? items.slice(-limit) : items;
				const skipped = limit && items.length > limit ? items.length - limit : 0;
				let text = "";
				if (skipped > 0) text += theme.fg("muted", `... ${skipped} earlier items\n`);
				for (const item of toShow) {
					if (item.type === "text") {
						const preview = expanded ? item.text : item.text.split("\n").slice(0, 3).join("\n");
						text += `${theme.fg("toolOutput", preview)}\n`;
					} else {
						text += `${theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme))}\n`;
					}
				}
				return text.trimEnd();
			};

			if (details.mode === "single" && details.results.length === 1) {
				const r = details.results[0];
				const isError = isFailedResult(r);
				const icon = isError ? theme.fg("error", "✗") : theme.fg("success", "✓");
				const displayItems = getDisplayItems(r.messages);
				const finalOutput = getFinalOutput(r.messages);

				if (expanded) {
					const container = new Container();
					let header = `${icon} ${theme.fg("toolTitle", theme.bold(r.agent))}${theme.fg("muted", ` (${r.agentSource})`)}`;
					if (isError && r.stopReason) header += ` ${theme.fg("error", `[${r.stopReason}]`)}`;
					container.addChild(new Text(header, 0, 0));
					if (isError && r.errorMessage)
						container.addChild(new Text(theme.fg("error", `Error: ${r.errorMessage}`), 0, 0));
					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", "─── Task ───"), 0, 0));
					container.addChild(new Text(theme.fg("dim", r.task), 0, 0));
					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", "─── Output ───"), 0, 0));
					if (displayItems.length === 0 && !finalOutput) {
						container.addChild(new Text(theme.fg("muted", "(no output)"), 0, 0));
					} else {
						for (const item of displayItems) {
							if (item.type === "toolCall")
								container.addChild(
									new Text(
										theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme)),
										0,
										0,
									),
								);
						}
						if (finalOutput) {
							container.addChild(new Spacer(1));
							container.addChild(new Markdown(finalOutput.trim(), 0, 0, mdTheme));
						}
					}
					const usageStr = formatUsageStats(r.usage, r.model);
					if (usageStr) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", usageStr), 0, 0));
					}
					return container;
				}

				let text = `${icon} ${theme.fg("toolTitle", theme.bold(r.agent))}${theme.fg("muted", ` (${r.agentSource})`)}`;
				if (isError && r.stopReason) text += ` ${theme.fg("error", `[${r.stopReason}]`)}`;
				if (isError && r.errorMessage) text += `\n${theme.fg("error", `Error: ${r.errorMessage}`)}`;
				else if (displayItems.length === 0) text += `\n${theme.fg("muted", "(no output)")}`;
				else {
					text += `\n${renderDisplayItems(displayItems, COLLAPSED_ITEM_COUNT)}`;
					if (displayItems.length > COLLAPSED_ITEM_COUNT) text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
				}
				const usageStr = formatUsageStats(r.usage, r.model);
				if (usageStr) text += `\n${theme.fg("dim", usageStr)}`;
				return new Text(text, 0, 0);
			}

			const aggregateUsage = (results: SingleResult[]) => {
				const total = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0 };
				for (const r of results) {
					total.input += r.usage.input;
					total.output += r.usage.output;
					total.cacheRead += r.usage.cacheRead;
					total.cacheWrite += r.usage.cacheWrite;
					total.cost += r.usage.cost;
					total.turns += r.usage.turns;
				}
				return total;
			};

			if (details.mode === "chain") {
				const successCount = details.results.filter((r) => r.exitCode === 0).length;
				const icon = successCount === details.results.length ? theme.fg("success", "✓") : theme.fg("error", "✗");

				if (expanded) {
					const container = new Container();
					container.addChild(
						new Text(
							icon +
								" " +
								theme.fg("toolTitle", theme.bold("chain ")) +
								theme.fg("accent", `${successCount}/${details.results.length} steps`),
							0,
							0,
						),
					);

					for (const r of details.results) {
						const rIcon = r.exitCode === 0 ? theme.fg("success", "✓") : theme.fg("error", "✗");
						const displayItems = getDisplayItems(r.messages);
						const finalOutput = getFinalOutput(r.messages);

						container.addChild(new Spacer(1));
						container.addChild(
							new Text(
								`${theme.fg("muted", `─── Step ${r.step}: `) + theme.fg("accent", r.agent)} ${rIcon}`,
								0,
								0,
							),
						);
						container.addChild(new Text(theme.fg("muted", "Task: ") + theme.fg("dim", r.task), 0, 0));

						// Show tool calls
						for (const item of displayItems) {
							if (item.type === "toolCall") {
								container.addChild(
									new Text(
										theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme)),
										0,
										0,
									),
								);
							}
						}

						// Show final output as markdown
						if (finalOutput) {
							container.addChild(new Spacer(1));
							container.addChild(new Markdown(finalOutput.trim(), 0, 0, mdTheme));
						}

						const stepUsage = formatUsageStats(r.usage, r.model);
						if (stepUsage) container.addChild(new Text(theme.fg("dim", stepUsage), 0, 0));
					}

					const usageStr = formatUsageStats(aggregateUsage(details.results));
					if (usageStr) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", `Total: ${usageStr}`), 0, 0));
					}
					return container;
				}

				// Collapsed view
				let text =
					icon +
					" " +
					theme.fg("toolTitle", theme.bold("chain ")) +
					theme.fg("accent", `${successCount}/${details.results.length} steps`);
				for (const r of details.results) {
					const rIcon = r.exitCode === 0 ? theme.fg("success", "✓") : theme.fg("error", "✗");
					const displayItems = getDisplayItems(r.messages);
					text += `\n\n${theme.fg("muted", `─── Step ${r.step}: `)}${theme.fg("accent", r.agent)} ${rIcon}`;
					if (displayItems.length === 0) text += `\n${theme.fg("muted", "(no output)")}`;
					else text += `\n${renderDisplayItems(displayItems, 5)}`;
				}
				const usageStr = formatUsageStats(aggregateUsage(details.results));
				if (usageStr) text += `\n\n${theme.fg("dim", `Total: ${usageStr}`)}`;
				text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
				return new Text(text, 0, 0);
			}

			if (details.mode === "parallel") {
				const running = details.results.filter((r) => r.exitCode === -1).length;
				const successCount = details.results.filter((r) => r.exitCode !== -1 && !isFailedResult(r)).length;
				const failCount = details.results.filter((r) => r.exitCode !== -1 && isFailedResult(r)).length;
				const isRunning = running > 0;
				const icon = isRunning
					? theme.fg("warning", "⏳")
					: failCount > 0
						? theme.fg("warning", "◐")
						: theme.fg("success", "✓");
				const status = isRunning
					? `${successCount + failCount}/${details.results.length} done, ${running} running`
					: `${successCount}/${details.results.length} tasks`;

				if (expanded && !isRunning) {
					const container = new Container();
					container.addChild(
						new Text(
							`${icon} ${theme.fg("toolTitle", theme.bold("parallel "))}${theme.fg("accent", status)}`,
							0,
							0,
						),
					);

					for (const r of details.results) {
						const rIcon = isFailedResult(r) ? theme.fg("error", "✗") : theme.fg("success", "✓");
						const displayItems = getDisplayItems(r.messages);
						const finalOutput = getFinalOutput(r.messages);

						container.addChild(new Spacer(1));
						container.addChild(
							new Text(`${theme.fg("muted", "─── ") + theme.fg("accent", r.agent)} ${rIcon}`, 0, 0),
						);
						container.addChild(new Text(theme.fg("muted", "Task: ") + theme.fg("dim", r.task), 0, 0));

						// Show tool calls
						for (const item of displayItems) {
							if (item.type === "toolCall") {
								container.addChild(
									new Text(
										theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme)),
										0,
										0,
									),
								);
							}
						}

						// Show final output as markdown
						if (finalOutput) {
							container.addChild(new Spacer(1));
							container.addChild(new Markdown(finalOutput.trim(), 0, 0, mdTheme));
						}

						const taskUsage = formatUsageStats(r.usage, r.model);
						if (taskUsage) container.addChild(new Text(theme.fg("dim", taskUsage), 0, 0));
					}

					const usageStr = formatUsageStats(aggregateUsage(details.results));
					if (usageStr) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", `Total: ${usageStr}`), 0, 0));
					}
					return container;
				}

				// Collapsed view (or still running)
				let text = `${icon} ${theme.fg("toolTitle", theme.bold("parallel "))}${theme.fg("accent", status)}`;
				for (const r of details.results) {
					const rIcon =
						r.exitCode === -1
							? theme.fg("warning", "⏳")
							: isFailedResult(r)
								? theme.fg("error", "✗")
								: theme.fg("success", "✓");
					const displayItems = getDisplayItems(r.messages);
					text += `\n\n${theme.fg("muted", "─── ")}${theme.fg("accent", r.agent)} ${rIcon}`;
					if (displayItems.length === 0)
						text += `\n${theme.fg("muted", r.exitCode === -1 ? "(running...)" : "(no output)")}`;
					else text += `\n${renderDisplayItems(displayItems, 5)}`;
				}
				if (!isRunning) {
					const usageStr = formatUsageStats(aggregateUsage(details.results));
					if (usageStr) text += `\n\n${theme.fg("dim", `Total: ${usageStr}`)}`;
				}
				if (!expanded) text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
				return new Text(text, 0, 0);
			}

			const text = result.content[0];
			return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
		},
	});

	pi.registerTool({
		name: "run_runner",
		label: "Run Runner Gate",
		description: [
			"Run the read-only verification gate (runner subagent).",
			"Returns VERDICT: PASSED | FAILED | BLOCKED and records evidence in .pi/gates/runner-last.json.",
			"Only PASSED advances house-apply verification and house-archive.",
		].join(" "),
		parameters: RunnerParams,

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const roster = loadRoster();
			const dispatchDefaults: DispatchDefaults = {
				model: ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined,
				thinkingLevel: ctx.thinkingLevel,
				presetModels: roster.activePreset ? roster.presets[roster.activePreset] : undefined,
			};
			const discovery = discoverAgents(ctx.cwd, "both");
			const makeDetails = (results: SingleResult[]): SubagentDetails => ({
				mode: "single",
				agentScope: "both",
				projectAgentsDir: discovery.projectAgentsDir,
				results,
			});

			const result = await runSingleAgent(
				ctx.cwd,
				dispatchDefaults,
				discovery.agents,
				"runner",
				params.task,
				params.cwd,
				undefined,
				signal,
				onUpdate,
				makeDetails,
			);

			const output = getFinalOutput(result.messages) || result.stderr || "(no output)";
			const verdict = parseRunnerVerdict(output, result.exitCode);
			const runCwd = params.cwd ?? ctx.cwd;
			await recordRunnerEvidence(runCwd, {
				verdict,
				timestamp: new Date().toISOString(),
				exitCode: result.exitCode,
				task: params.task,
				model: result.model,
			});

			return {
				content: [{ type: "text", text: `VERDICT: ${verdict}\n\n${output}` }],
				details: {
					verdict,
					evidencePath: path.join(gatesDirFor(runCwd), "runner-last.json"),
					results: [result],
				},
				isError: verdict !== "PASSED",
			};
		},
	});

	pi.registerCommand("new-agent", {
		description: "Scaffold a new subagent definition (roster-gap protocol): choose scope, class, tools, model",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("/new-agent is interactive; run it from the TUI.", "error");
				return;
			}

			const scope = await ctx.ui.select("Scope", [
				{ value: "global", label: "global (~/.pi/agent/agents) — every project" },
				{ value: "project", label: "project (.pi/agents) — this repo only (overrides global on name clash)" },
			]);
			if (!scope) return;

			const nameInput = await ctx.ui.input("Agent name (a-z, 0-9, _ -):", { defaultValue: "" });
			const name = (nameInput ?? "").trim();
			if (!/^[a-z][a-z0-9_-]{0,31}$/.test(name)) {
				ctx.ui.notify(`Invalid agent name "${name}". Use [a-z][a-z0-9_-]{0,31}.`, "error");
				return;
			}

			const agentClass = await ctx.ui.select("Class", [
				{ value: "read-only", label: "read-only — recon/research/analysis (no write tools)" },
				{ value: "write", label: "write — implementation/design (full built-in tools)" },
				{ value: "gate", label: "gate — read-only + bash, no write/edit (verification/delivery)" },
			]);
			if (!agentClass) return;

			const descInput = await ctx.ui.input(
				"Description — when to delegate (the orchestrator sees this in the subagent tool):",
				{ defaultValue: "" },
			);
			const description = (descInput ?? "").trim();
			if (!description) {
				ctx.ui.notify("Description is required.", "error");
				return;
			}

			const modelInput = await ctx.ui.input("Model (empty = inherit session model, e.g. omni/...):", {
				defaultValue: "",
			});
			const model = (modelInput ?? "").trim();

			const toolsByClass: Record<string, string> = {
				"read-only": "read, grep, find, ls",
				write: "read, write, edit, bash, grep, find, ls",
				gate: "read, grep, find, ls, bash",
			};

			const rulesByClass: Record<string, string> = {
				"read-only": "READ-ONLY: inspect and report; do not modify files. Do not use bash.",
				write: "Prefer dedicated file tools (read/edit/write) for code work; use bash for execution and automation (git, tests, builds).",
				gate: "READ-ONLY on files: never edit or write source. Use bash only for the lane's commands (e.g. verification or git/gh).",
			};

			let dir: string;
			if (scope === "project") {
				dir = path.join(ctx.cwd, CONFIG_DIR_NAME, "agents");
			} else {
				dir = path.join(getAgentDir(), "agents");
			}
			await fs.promises.mkdir(dir, { recursive: true });
			const filePath = path.join(dir, `${name}.md`);

			const frontmatter: string[] = ["---", `name: ${name}`, `description: ${description}`];
			frontmatter.push(`tools: ${toolsByClass[agentClass]}`);
			if (model) frontmatter.push(`model: ${model}`);
			frontmatter.push("---");

			const body = [
				`You are ${name} - a focused specialist.`,
				"",
				"**Role**: " + description,
				"",
				"**File Operations Rules**:",
				"- " + rulesByClass[agentClass],
				"",
				"(Fill in the specialist behavior, output contract, and constraints for this lane.)",
			];

			await withFileMutationQueue(filePath, async () => {
				await fs.promises.writeFile(filePath, frontmatter.join("\n") + "\n\n" + body.join("\n") + "\n", "utf-8");
			});
			ctx.ui.notify(`Created ${filePath}\nAgents are re-discovered on the next invocation — no reload needed.`, "success");
		},
	});

	pi.registerTool({
		name: "run_fix_loop",
		label: "Run Fix Loop",
		description: [
			"Run the explicit fixer↔oracle review loop and write review.md (schema artifact).",
			"fixer implements per plan → oracle reviews (cumulative diff) → fixer adjusts on findings → re-review, up to 3 rounds.",
			"Returns VERDICT: PASSED (no blocking open findings) or BLOCKED (cap reached, waiver needed).",
			"Writes the review record to openspec/changes/<name>/review.md (or .pi/fix-loop/review.md).",
		].join(" "),
		parameters: Type.Object({
			task: Type.String({ description: "Task or plan context for the loop (e.g. 'implement plan X' or a query)" }),
			cwd: Type.Optional(Type.String({ description: "Working directory (project root with openspec/changes/)" })),
		}),

		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const roster = loadRoster();
			const dispatchDefaults: DispatchDefaults = {
				model: ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined,
				thinkingLevel: ctx.thinkingLevel,
				presetModels: roster.activePreset ? roster.presets[roster.activePreset] : undefined,
			};
			const discovery = discoverAgents(params.cwd ?? ctx.cwd, "both");
			const runCwd = params.cwd ?? ctx.cwd;
			const result = await runFixLoop(dispatchDefaults, discovery.agents, discovery.projectAgentsDir, signal, {
				task: params.task,
				cwd: runCwd,
			});
			const reviewPath = await writeReviewArtifact(result, runCwd);
			const summary = `VERDICT: ${result.verdict}\nReview record: ${reviewPath}\n\n${result.iterationLog.join("\n")}\n\nRemaining findings (if any): ${JSON.stringify(result.findings, null, 2)}`;
			return {
				content: [{ type: "text", text: summary }],
				details: { verdict: result.verdict, reviewPath, findings: result.findings, iterationLog: result.iterationLog },
				isError: result.verdict !== "PASSED",
			};
		},
	});

	pi.registerCommand("fix-loop", {
		description: "Run the explicit fixer↔oracle review loop; writes review.md (schema artifact)",
		handler: async (args, ctx) => {
			const roster = loadRoster();
			const dispatchDefaults: DispatchDefaults = {
				model: ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined,
				thinkingLevel: ctx.thinkingLevel,
				presetModels: roster.activePreset ? roster.presets[roster.activePreset] : undefined,
			};
			const discovery = discoverAgents(ctx.cwd, "both");
			const result = await runFixLoop(dispatchDefaults, discovery.agents, discovery.projectAgentsDir, undefined, {
				task: (args ?? "").trim(),
				cwd: ctx.cwd,
			});
			const reviewPath = await writeReviewArtifact(result, ctx.cwd);
			const lines = [
				`Fix loop ${result.verdict}`, ...result.iterationLog,
				`Review record: ${reviewPath}`,
			];
			if (result.verdict === "BLOCKED" && result.findings.length > 0) {
				lines.push("", "Blocking open findings remain — record a human waiver decision in review.md (status: waived) or extend the loop.");
			}
			ctx.ui.notify(lines.join("\n"), result.verdict === "PASSED" ? "success" : "error");
		},
	});

	pi.registerCommand("preset", {
		description: "List or switch the subagent roster preset (per-agent model assignments from roster.json)",
		handler: async (args, ctx) => {
			const filePath = path.join(getAgentDir(), "roster.json");
			const roster = loadRoster();
			const names = Object.keys(roster.presets);
			const arg = (args ?? "").trim();

			if (!arg || arg === "list") {
				const lines = [`Active preset: ${roster.activePreset ?? "(none)"}`, `Available: ${names.join(", ") || "none"}`];
				if (roster.activePreset && roster.presets[roster.activePreset]) {
					lines.push("", "Agent → model:");
					for (const [agent, model] of Object.entries(roster.presets[roster.activePreset])) {
						lines.push(`  ${agent}: ${model}`);
					}
				}
				ctx.ui.notify(lines.join("\n"), "info");
				return;
			}

			if (!roster.presets[arg]) {
				ctx.ui.notify(`Unknown preset "${arg}". Available: ${names.join(", ") || "none"}`, "error");
				return;
			}

			roster.activePreset = arg;
			await withFileMutationQueue(filePath, async () => {
				await fs.promises.writeFile(filePath, JSON.stringify(roster, null, 2) + "\n", "utf-8");
			});
			ctx.ui.notify(`Preset switched to "${arg}".`, "success");
		},
	});

	pi.registerCommand("gate-status", {
		description: "Show the last runner gate record (.pi/gates/runner-last.json)",
		handler: async (_args, ctx) => {
			try {
				const raw = await fs.promises.readFile(path.join(gatesDirFor(ctx.cwd), "runner-last.json"), "utf-8");
				ctx.ui.notify(raw.trim(), "info");
			} catch {
				ctx.ui.notify("No runner gate record in this workspace yet. Run the run_runner tool first.", "error");
			}
		},
	});

	pi.registerCommand("approve-merge", {
		description: "Record explicit user approval to merge a PR (unblocks the integrator merge gate)",
		handler: async (args, ctx) => {
			const pr = (args ?? "").trim();
			const prNumber = pr.match(/\d+/)?.[0];
			if (!prNumber) {
				ctx.ui.notify("Usage: /approve-merge <PR number or URL>", "error");
				return;
			}
			const ok = await ctx.ui.confirm(
				"Approve merge?",
				`Record approval to merge PR #${prNumber}? This is what the integrator merge gate checks.`,
			);
			if (!ok) {
				ctx.ui.notify("Merge approval canceled.", "info");
				return;
			}
			const approvals = await readMergeApprovals(ctx.cwd);
			approvals[prNumber] = { approvedAt: Date.now() };
			await writeMergeApprovals(ctx.cwd, approvals);
			ctx.ui.notify(`Merge approval recorded for PR #${prNumber}.`, "success");
		},
	});

	pi.on("tool_call", async (event, ctx) => {
		if (!isToolCallEventType("bash", event)) return;
		const command = event.input.command ?? "";
		const isMerge = /\bgh\s+pr\s+merge\b/.test(command);
		const isForcePush = /git\s+push\b[^|&;]*(-f|--force)/.test(command);
		if (!isMerge && !isForcePush) return;

		const prNumber = extractPrNumber(command);
		const approvals = await readMergeApprovals(ctx.cwd);
		const approved = prNumber ? Boolean(approvals[prNumber]) : false;
		if (approved) return;

		return {
			block: true,
			reason: `Merge gate: no recorded approval${prNumber ? ` for PR #${prNumber}` : " (specify the PR number)"}. Record one with /approve-merge <pr-number>, then retry.`,
		};
	});
}
