import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	applyTarget,
	block,
	DEFAULT_STATE,
	isOffRequest,
	matchModeInput,
	parseTarget,
	reminder,
	statusLine,
	type DeslopState,
	type Target,
} from "./src/deslop.ts";

const USAGE = "Usage: /deslop [lite|full|ultra|on|off|status]";

function targetMessage(state: DeslopState, target: Target): string | undefined {
	switch (target.kind) {
		case "status":
			return statusLine(state);
		case "help":
			return USAGE;
		case "unknown":
			return `Unknown level "${target.raw}". ${USAGE}`;
		default:
			return undefined;
	}
}

export default function deslop(pi: ExtensionAPI) {
	let state: DeslopState = { ...DEFAULT_STATE };

	pi.on("session_start", async () => {
		state = { ...DEFAULT_STATE };
	});

	pi.on("before_agent_start", async (event) => {
		const options = event.systemPromptOptions;
		const text = block(state);
		if (options) {
			if (text === undefined) {
				if (options.sections) delete options.sections.deslop;
			} else {
				options.sections = { ...options.sections, deslop: text };
			}
		}

		// Mirrors the upstream UserPromptSubmit hook: keep the rules next to the current turn.
		const reminderText = event.messageType === "user" ? reminder(state) : undefined;
		if (reminderText === undefined) return;
		return {
			message: {
				customType: "deslop-reminder",
				content: reminderText,
				display: false,
			},
		};
	});

	pi.on("input", async (event, ctx) => {
		if (event.source === "extension") return { action: "continue" };

		const off = isOffRequest(event.text);
		if (off !== undefined) {
			state = applyTarget(state, { kind: "off", shared: off === "shared" });
			if (ctx.hasUI) ctx.ui.notify("Deslop off for this session", "info");
			// "normal mode" is shared with other prose-mode extensions, so let them see it too.
			return { action: off === "shared" ? "continue" : "handled" };
		}

		const mode = matchModeInput(event.text);
		if (mode === undefined) return { action: "continue" };
		state = applyTarget(state, mode === "on" ? { kind: "on" } : { kind: "set", level: mode });
		if (ctx.hasUI) ctx.ui.notify(statusLine(state), "info");
		return { action: "handled" };
	});

	pi.registerCommand("deslop", {
		description: "Set Claude-ism removal: lite, full (default), ultra, or off",
		getArgumentCompletions: (prefix) => {
			const values = ["lite", "full", "ultra", "on", "off", "status"];
			const matches = values.filter((value) => value.startsWith(prefix.toLowerCase()));
			return matches.length > 0 ? matches.map((value) => ({ value, label: value })) : null;
		},
		handler: async (args, ctx) => {
			const target = parseTarget(args);
			const message = targetMessage(state, target);
			state = applyTarget(state, target);
			if (ctx.hasUI) {
				ctx.ui.notify(message ?? statusLine(state), target.kind === "unknown" ? "warning" : "info");
			}
		},
	});
}
