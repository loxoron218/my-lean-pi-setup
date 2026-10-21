# Maintenance

Upstream: [`@narumitw/pi-usage`](https://github.com/narumiruna/pi-extensions) (`packages/pi-usage`), pinned to `0.67.0` in `dependencies` (exact pin; the tests enforce the command list and the pinned descriptions).

## What the facade does

- Runs the upstream extension with a capturing `pi` proxy: `registerCommand` calls are intercepted and re-registered under the same name with the same options object except a shorter `description`; the `handler` is the original upstream function reference.
- Everything else passes through bound: all `on(...)` event subscriptions (session/turn/tree/model lifecycle that drives the usage queries and statusline), `setStatus`, `exec`, and so on.
- Nothing is merged and nothing is hidden: upstream registers zero tools and two commands, so there is no `op` router and no `help` op. The full upstream descriptions are recorded in `tests/lean.test.mjs` (`EXPECTED_UPSTREAM_DESCRIPTIONS`) and in the README table.

## Trimmed per command

- `usage`: "Show usage for the current runtime account" → "Usage of current runtime account". Drops the verb and article; keeps `runtime account`, which distinguishes the current runtime from the other configured providers the menu can show.
- `fast`: "Toggle Codex Fast mode" → "Toggle Codex Fast". Drops the generic `mode`; keeps the verb (arg-less toggle) and the `Codex Fast` brand (the settings key and statusline label).

Upstream was already near-minimal, so this saves 15 chars / 3 tokens. If a future upstream rewords either description to carry new meaning (e.g. new `/usage` arguments), prefer restoring words over keeping the counts.

## Upstream internals this depends on

- Command names: `usage`, `fast`. A rename/add/remove breaks the "exactly the upstream commands" test on purpose.
- `registerCommand(name, options)` signature with `{ description, handler }`; options are spread through, so added option fields survive automatically.
- Entry point `./dist/index.ts` default-exporting the `usageExtension` activate function (the `pi.extensions` entry in upstream `package.json`); the lean wrapper imports `@narumitw/pi-usage/dist/index.ts`.
- Upstream calls no `registerTool` and no `setActiveTools`; the "never touches tools" test pins that. If a future upstream adds tools, this wrapper must grow a tool-capturing facade (see `pi-plan-mode-lean` for the pattern) instead of silently publishing them.
- Typecheck pins `@earendil-works/pi-coding-agent`/`pi-tui` devDeps at `1.2.0` (upstream's own versions).

## Tracking a new upstream version

1. Bump `version` and the pinned `dependencies` entry together; keep them equal.
2. Re-check the upstream command list: any added/removed/renamed command or reworded description fails the tests — update `LEAN_DESCRIPTIONS`, the README table, and the char/token counts here.
3. Re-check for new `registerTool`/`setActiveTools` calls upstream; if any appear, add tool capture (never publish upstream tools directly).
4. Run `npm run check` here.
5. Update the Versions sections.
