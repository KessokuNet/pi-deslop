import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { beforeEach, describe, expect, it, vi } from "vitest";
import deslop from "../index.ts";
import { DEFAULT_STATE, isOffRequest, matchModeInput, parseTarget } from "../src/deslop.ts";

type PromptOptions = { sections?: Record<string, string> };
type PromptEvent = { systemPromptOptions?: PromptOptions; messageType?: "user" | "custom" };
type Handler = (event: unknown, ctx: unknown) => Promise<unknown> | unknown;
type Command = { handler: (args: string, ctx: unknown) => Promise<void> };

function harness() {
	const handlers = new Map<string, Handler>();
	const commands = new Map<string, Command>();
	const api = {
		on: (name: string, handler: Handler) => {
			handlers.set(name, handler);
		},
		registerCommand: (name: string, command: Command) => {
			commands.set(name, command);
		},
	};
	deslop(api as unknown as ExtensionAPI);

	const notify = vi.fn();
	const ctx = { hasUI: true, ui: { notify } };

	async function run(name: string, event: unknown) {
		const handler = handlers.get(name);
		if (!handler) throw new Error(`no handler for ${name}`);
		return handler(event, ctx);
	}

	async function prompt(event: PromptEvent = { messageType: "user" }) {
		const options: PromptOptions = event.systemPromptOptions ?? {};
		const result = (await run("before_agent_start", { ...event, systemPromptOptions: options })) as
			| { message?: { content?: string; display?: boolean } }
			| undefined;
		return { sections: options.sections, message: result?.message };
	}

	async function command(args: string) {
		const registered = commands.get("deslop");
		if (!registered) throw new Error("no /deslop command");
		await registered.handler(args, ctx);
	}

	return { run, prompt, command, notify };
}

describe("deslop extension", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("injects the full-level block and a per-turn reminder", async () => {
		const app = harness();
		const { sections, message } = await app.prompt();
		expect(sections?.deslop).toContain("level full");
		expect(message?.content).toContain("DESLOP:");
		expect(message?.display).toBe(false);
	});

	it("switches level with /deslop ultra and tightens the reminder", async () => {
		const app = harness();
		await app.command("ultra");
		const { sections, message } = await app.prompt();
		expect(sections?.deslop).toContain("level ultra");
		expect(message?.content).toContain("plain literal sentence wins");
		expect(app.notify).toHaveBeenLastCalledWith("deslop ultra", "info");
	});

	it("skips the reminder for runs not started by the user", async () => {
		const app = harness();
		const { message } = await app.prompt({ messageType: "custom" });
		expect(message).toBeUndefined();
	});

	it("removes the section when turned off and restores it with /deslop on", async () => {
		const app = harness();
		const first = await app.prompt();
		await app.command("off");
		const off = await app.prompt({ systemPromptOptions: { sections: first.sections } });
		expect(off.sections).not.toHaveProperty("deslop");
		expect(off.message).toBeUndefined();

		await app.command("on");
		const on = await app.prompt({ systemPromptOptions: { sections: off.sections } });
		expect(on.sections?.deslop).toContain("level full");
	});

	it("reports status without changing the level", async () => {
		const app = harness();
		await app.command("lite");
		await app.command("status");
		expect(app.notify).toHaveBeenLastCalledWith("deslop lite", "info");
	});

	it("rejects unknown levels with the usage line", async () => {
		const app = harness();
		await app.command("loud");
		expect(app.notify).toHaveBeenLastCalledWith(expect.stringContaining("Unknown level \"loud\""), "warning");
	});

	it("handles 'stop deslop' without spending a turn", async () => {
		const app = harness();
		const result = await app.run("input", { source: "interactive", text: "stop deslop" });
		expect(result).toEqual({ action: "handled" });
		expect((await app.prompt()).sections).toBeUndefined();
	});

	it("passes 'normal mode' through so other prose modes turn off too", async () => {
		const app = harness();
		const result = await app.run("input", { source: "interactive", text: "normal mode" });
		expect(result).toEqual({ action: "continue" });
		expect((await app.prompt()).sections).toBeUndefined();
	});

	it("handles bare 'deslop lite' typed without the slash", async () => {
		const app = harness();
		const result = await app.run("input", { source: "interactive", text: "deslop lite" });
		expect(result).toEqual({ action: "handled" });
		expect((await app.prompt()).sections?.deslop).toContain("level lite");
	});

	it("leaves ordinary prose alone", async () => {
		const app = harness();
		const result = await app.run("input", { source: "interactive", text: "deslop the changelog please" });
		expect(result).toEqual({ action: "continue" });
	});

	it("resets to the default level on session start", async () => {
		const app = harness();
		await app.command("lite");
		await app.run("session_start", { reason: "new" });
		expect((await app.prompt()).sections?.deslop).toContain("level full");
	});
});

describe("parsing", () => {
	it("maps command arguments to targets", () => {
		expect(parseTarget("")).toEqual({ kind: "status" });
		expect(parseTarget("ultra")).toEqual({ kind: "set", level: "ultra" });
		expect(parseTarget("normal mode")).toEqual({ kind: "off", shared: true });
		expect(parseTarget("off")).toEqual({ kind: "off", shared: false });
		expect(parseTarget("loud")).toEqual({ kind: "unknown", raw: "loud" });
	});

	it("distinguishes shared and specific off requests", () => {
		expect(isOffRequest("Stop deslop.")).toBe("specific");
		expect(isOffRequest("normal mode")).toBe("shared");
		expect(isOffRequest("please stop deslop now")).toBeUndefined();
	});

	it("recognizes mode input", () => {
		expect(matchModeInput("deslop")).toBe("on");
		expect(matchModeInput("deslop full")).toBe("full");
		expect(matchModeInput("deslop full please")).toBeUndefined();
	});

	it("defaults to full and enabled", () => {
		expect(DEFAULT_STATE).toEqual({ enabled: true, level: "full" });
	});
});
