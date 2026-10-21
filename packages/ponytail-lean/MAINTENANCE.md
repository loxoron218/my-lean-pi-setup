# Maintenance

Upstream: [`@dietrichgebert/ponytail`](https://github.com/DietrichGebert/ponytail), pinned to `5.3.2` in `dependencies` (exact pin; the tests enforce the command list, event list, command/skill description sizes, and full-prompt size).

## What the facade does

- Does **not** run the upstream pi extension. Upstream's value here is one pure function — `getPonytailInstructions("full")` from `hooks/ponytail-instructions.js` — plus its `SKILL.md`, both loaded from the installed dependency at runtime. No upstream code is copied and `node_modules` stays untouched.
- Registers exactly one event subscription, `before_agent_start`, which injects that text using upstream's own injection order (structured `sections.ponytail` first for prompt-cache stability, then the legacy whole-prompt fallbacks). Deviating from the lean guide's Proxy recipe on purpose: there are zero upstream tools to capture, and running the full upstream extension would recreate the mode state (env/config/session/commands) this package exists to remove.
- Reaching the hook file needs path work: the upstream `exports` map only exposes `"."` and `"./plugin"` (both the OpenCode plugin), so deep specifier imports fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`. `index.ts` resolves the package root through the exported entry and requires the hook by absolute path, which bypasses the exports map.

## Trimmed per surface

- Commands: all six (`ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-gain`, `ponytail-debt`, `ponytail-help`; 186 chars) dropped — lean registers none.
- Skills: all six skill frontmatter descriptions (1340 chars) dropped — lean ships no `skills` directory, so they never load.
- Modes: lite/ultra/off/review dropped — `PONYTAIL_DEFAULT_MODE`, `config.json`, stored `ponytail-mode` session entries, and the `stop ponytail` / `normal mode` chat switch are all ignored; the injected text is always the full build.
- Prompt text: not trimmed at all (verbatim `getPonytailInstructions("full")`, 2859 chars). Trimming it would change the behavior being kept.

## Upstream internals this depends on

- Package root layout: `require.resolve("@dietrichgebert/ponytail")` must land three levels below the root (`.opencode/plugins/ponytail.mjs`). Pi's loader cannot resolve the bare root, so `index.ts` falls back to finding `node_modules/@dietrichgebert/ponytail/package.json` upward from the module. A moved entry or relocated dependency breaks activation loudly.
- `hooks/ponytail-instructions.js` exporting `getPonytailInstructions(mode)`, and `mode "full"` producing text starting with `PONYTAIL MODE ACTIVE — level: full`.
- Upstream pi extension surface: six commands, zero `registerTool` calls, zero `setActiveTools` calls, and the eight subscribed events (`input`, `session_start`, `session_tree`, `session_switch`, `session_branch`, `agent_start`, `agent_end`, `before_agent_start`). Any addition/rename/reword fails the tests — decide then whether the new surface stays dropped or needs a lean equivalent.
- Typecheck pins `@earendil-works/pi-coding-agent`/`pi-tui` devDeps at `1.3.0` (same as the sibling lean packages).

## Tracking a new upstream version

1. Bump `version` and the pinned `dependencies` entry together; keep them equal.
2. Re-check the upstream command/skill/mode lists: anything new stays dropped by default — document the choice here.
3. Re-check the full-mode prompt size (2859 chars): a reword changes per-turn tokens — update the README table and the test pin.
4. Re-check the exports map and hook path: if deep imports become allowed, prefer the plain specifier import and delete the path workaround.
5. Run `npm run check` here.
6. Update the Versions sections. This package is intentionally not wired into the `my-lean-pi-setup` benchmark harness config: the harness measures per-turn `promptDelta` (identical by design here), not the removed startup surface, so a harness row would read 715 vs 715.
