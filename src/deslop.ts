export const LEVELS = ["lite", "full", "ultra"] as const;
export type Level = (typeof LEVELS)[number];

export type DeslopState = {
	enabled: boolean;
	level: Level;
};

export type Target =
	| { kind: "set"; level: Level }
	| { kind: "on" }
	| { kind: "off"; shared: boolean }
	| { kind: "status" }
	| { kind: "help" }
	| { kind: "unknown"; raw: string };

export const DEFAULT_STATE: DeslopState = { enabled: true, level: "full" };

const LEVEL_GUIDANCE: Record<Level, string> = {
	lite: "Hard-banned phrases and the capitulation reflex only. Pattern rules and sentence mechanics relaxed.",
	full: "Phrase bans, pattern rules, and behavioral bans all enforced.",
	ultra: "Full enforcement, plus zero tolerance on borderline metaphor: when in doubt, the plain literal sentence wins.",
};

const OFF_INPUT = /^(?:stop deslop|deslop off|normal mode)[.!]?$/i;
const MODE_INPUT = /^deslop(?:\s+(lite|full|ultra))?[.!]?$/i;

const REMINDER_FULL =
	'DESLOP: no Claude-isms ("sit with it", "load-bearing", "footgun", "and honestly?", coined quoted labels), no metaphorical "scope/seam/shape/spine", no "it\'s not just X, it\'s Y", no capitulation without new information. Short sentences, active voice, plain words, no fragments. Bans phrasing, not substance.';

const REMINDER_LITE =
	'DESLOP: no Claude-isms ("sit with it", "load-bearing", "footgun", "and honestly?", coined quoted labels), no capitulation without new information. Bans phrasing, not substance.';

export function isOffRequest(text: string): "specific" | "shared" | undefined {
	const match = OFF_INPUT.exec(text.trim());
	if (!match) return undefined;
	return /^normal mode/i.test(text.trim()) ? "shared" : "specific";
}

export function matchModeInput(text: string): Level | "on" | undefined {
	const match = MODE_INPUT.exec(text.trim());
	if (!match) return undefined;
	const level = match[1]?.toLowerCase();
	return level === undefined ? "on" : (level as Level);
}

export function parseTarget(args: string): Target {
	const raw = args.trim().toLowerCase();
	if (raw === "" || raw === "status") return { kind: "status" };
	if (raw === "help") return { kind: "help" };
	if (raw === "on" || raw === "enable") return { kind: "on" };
	if (raw === "normal" || raw === "normal mode") return { kind: "off", shared: true };
	if (raw === "off" || raw === "stop" || raw === "stop deslop") return { kind: "off", shared: false };
	if ((LEVELS as readonly string[]).includes(raw)) return { kind: "set", level: raw as Level };
	return { kind: "unknown", raw: args.trim() };
}

export function applyTarget(state: DeslopState, target: Target): DeslopState {
	switch (target.kind) {
		case "set":
			return { enabled: true, level: target.level };
		case "on":
			return { enabled: true, level: state.level };
		case "off":
			return { enabled: false, level: state.level };
		default:
			return state;
	}
}

export function statusLine(state: DeslopState): string {
	return state.enabled ? `deslop ${state.level}` : "deslop off";
}

export function block(state: DeslopState): string | undefined {
	if (!state.enabled) return undefined;
	return [
		`Deslop is active at level ${state.level}. Apply it to every response; read the deslop skill for the full rules.`,
		"It removes Claude-isms: the stock phrases and behavioral reflexes of AI prose.",
		'Hard-banned phrases ("sit with it", "load-bearing", "footgun", "and honestly?", coined quoted labels) never appear.',
		'Pattern rules: no reflexive-metaphor "scope", "seam", "shape", "spine", "canonical", "sanity check", "pushback"; literal use is fine.',
		'Behavioral bans: no capitulation on pushback without new information, no "It\'s not just X, it\'s Y", no closing option-tours.',
		"Deslop bans phrasing, not substance: genuine corrections, real tradeoffs, and honest uncertainty survive.",
		'Off only on "stop deslop" / "normal mode".',
		`Level: ${LEVEL_GUIDANCE[state.level]}`,
	].join("\n");
}

export function reminder(state: DeslopState): string | undefined {
	if (!state.enabled) return undefined;
	if (state.level === "lite") return REMINDER_LITE;
	if (state.level === "ultra") return `${REMINDER_FULL} When in doubt, the plain literal sentence wins.`;
	return REMINDER_FULL;
}
