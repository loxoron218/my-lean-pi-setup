# Maintenance

Upstream: [`pi-zentui`](https://github.com/lmilojevicc/pi-zentui), pinned to `0.33.0` in `dependencies` (exact pin; the tests enforce the command list and the pinned description). 0.33.0 adds bash syntax highlighting and tool-display override config/docs with no command-surface change (passes through untouched).

## What the facade does

- Runs the upstream extension with a capturing `pi` proxy: `registerCommand` calls are intercepted and re-registered under the same name with the same options object except a shorter `description`; the `handler` and `getArgumentCompletions` are the original upstream function references.
- Everything else passes through bound: all `on(...)` event subscriptions and `pi.events`, the `zentui-turn-summary` entry renderer, `exec`, and so on.
- Nothing is merged and nothing is hidden: upstream registers zero tools and one command, so there is no `op` router and no `help` op. The full upstream description is recorded in `tests/lean.test.mjs` (`EXPECTED_UPSTREAM_DESCRIPTIONS`) and in the README table.

## Trimmed per command

- `zentui`: "Configure Zentui" → "Zentui". Drops the generic verb; the `/zentui` settings panel already names every section (editor, messages, footer, …), so the bare brand is enough to find it.

Upstream was already near-minimal and tool-free, so this saves 10 chars / 2 tokens. If a future upstream rewords the description to carry new meaning (e.g. new `/zentui` arguments), prefer restoring words over keeping the counts.

## Upstream internals this depends on

- Command name: `zentui`. A rename/add/remove breaks the "exactly the upstream commands" test on purpose.
- `registerCommand(name, options)` signature with `{ description, handler, getArgumentCompletions }`; options are spread through, so added option fields survive automatically.
- Entry point `./extensions/zentui/index.ts` default-exporting the activate function (the `pi.extensions` entry in upstream `package.json`); the lean wrapper imports `pi-zentui/extensions/zentui/index.ts` (upstream ships raw `.ts`, no `exports` map, so the deep path import works).
- Upstream calls no `registerTool` and no `setActiveTools`; the "never touches tools" test pins that. If a future upstream adds tools, this wrapper must grow a tool-capturing facade (see `pi-plan-mode-lean` for the pattern) instead of silently publishing them.
- Activation reads `pi.events` (upstream `CustomVariables` subscribes at startup); the test stub provides it.
- Typecheck pins `@earendil-works/pi-coding-agent`/`pi-tui` devDeps at `1.3.0`. `tsconfig.json` targets ES2023 (not the repo-default ES2022) because upstream ships raw `.ts` and uses `Array.findLastIndex`.

## Tracking a new upstream version

1. Bump `version` and the pinned `dependencies` entry together; keep them equal.
2. Re-check the upstream command list: any added/removed/renamed command or reworded description fails the tests — update `LEAN_DESCRIPTIONS`, the README table, and the char/token counts here.
3. Re-check for new `registerTool`/`setActiveTools` calls upstream; if any appear, add tool capture (never publish upstream tools directly).
4. Run `npm run check` here.
5. Update the Versions sections.
