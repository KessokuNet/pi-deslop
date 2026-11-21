# pi-deslop

A pi port of [SeanL128/deslop](https://github.com/SeanL128/deslop), a Claude Code plugin that removes Claude-isms: the stock phrases, verbal tics, and behavioral reflexes that make prose read as AI-generated.

The skill text is unchanged. The plugin packaging is translated to pi: the `SessionStart` hook becomes a `deslop` system-prompt section, and the `UserPromptSubmit` hook becomes a per-turn reminder message, injected before each run that the user starts. Switches and levels run through extension state instead of conversational memory.

## Install

```sh
pi install /path/to/pi-deslop
```

Or try it for one run without touching settings:

```sh
pi -e /path/to/pi-deslop
```

## Use

| Input | Effect |
|---|---|
| `/deslop` or `/deslop status` | Show the current level |
| `/deslop lite` | Hard-banned phrases and the capitulation reflex only |
| `/deslop full` | Phrase bans, pattern rules, and behavioral bans (default) |
| `/deslop ultra` | Full, plus zero tolerance on borderline metaphor |
| `/deslop off`, `stop deslop` | Disable until re-enabled |
| `/deslop on` or a bare `deslop` | Re-enable at the last level |
| `/deslop help` | Usage line |

The level resets to `full` at the start of every session, matching the upstream plugin's always-on behavior. `/skill:deslop` loads the full skill text at any time; the injected section carries the short form.

`normal mode` disables deslop and every other prose-mode extension that recognizes the phrase. Each one turns itself off and passes the input on, so typing it with both pi-deslop and pi-shush installed turns both off.

## How it works

- `index.ts` writes the active level into `systemPromptOptions.sections.deslop` on `before_agent_start`. Pi diffs prompt sections, so an unchanged level costs nothing after the first turn and a level switch patches one section.
- The same handler returns a short `deslop-reminder` message on runs with `messageType === "user"`, mirroring the upstream hook that repeats the core rules every turn. Runs started by tools or extensions skip it.
- The `input` handler recognizes `stop deslop`, `normal mode`, and a bare `deslop [level]` before they reach the model, so switching costs no tokens and does not depend on the model noticing.
- `skills/deslop/SKILL.md` is copied verbatim from upstream and keeps the quality floor: genuine corrections, real tradeoffs, and honest uncertainty survive at every level.

## Development

```sh
npm install
npm run typecheck
npm test
```

## Credit

Skill, rules, and wording by [Sean Lindsay](https://seanlindsay.xyz), MIT licensed. This repository is only the pi packaging.
