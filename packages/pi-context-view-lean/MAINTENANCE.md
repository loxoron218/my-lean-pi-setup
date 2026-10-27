# Maintenance

Upstream: [`pi-context-view`](https://github.com/dimk90/pi-context-view), pinned to `0.8.0` in `dependencies` (exact pin; the tests enforce the command list and the pinned description). 0.8.0 added Injections filtering/search and Pi 1.4 capture matching with no command-surface change.

## What the facade does

- Runs the upstream extension with a capturing `pi` proxy: `registerCommand` calls are intercepted and re-registered under the same name with the same options object except a shorter `description`; the `handler` and `getArgumentCompletions` are the original upstream function references.
- Everything else passes through bound: all `on(...)` event subscriptions (request capture, silent probe, compaction tracking, session shutdown) and settings reads.
- Nothing is merged and nothing is hidden: upstream registers zero tools and one command, so there is no `op` router and no `help` op. The full upstream description is recorded in `tests/lean.test.mjs` (`EXPECTED_UPSTREAM_DESCRIPTIONS`) and in the README table.

## Trimmed per command

- `context`: "[usage|injections|config] - Inspect context usage, injections" → "[usage|injections|config] - Context usage and injections". Drops the weak verb; keeps the `[usage|injections|config]` calling convention.

## Upstream internals this depends on

- Command name: `context`. A rename/add/remove breaks the "exactly the upstream commands" test on purpose.
- `registerCommand(name, options)` signature with `{ description, handler, getArgumentCompletions }`; options are spread through, so added option fields survive automatically.
- Upstream calls no `registerTool` and no `setActiveTools`; the "never touches tools" test pins that. If a future upstream adds tools, this wrapper must grow a tool-capturing facade (see `pi-plan-mode-lean` for the pattern) instead of silently publishing them.
- Typecheck pins `@earendil-works/pi-coding-agent`/`pi-tui` devDeps at `1.3.0` (upstream's own versions and its minimum supported Pi).

## Tracking a new upstream version

1. Bump `version` and the pinned `dependencies` entry together; keep them equal.
2. Re-check the upstream command list: any added/removed/renamed command or reworded description fails the tests — update `LEAN_DESCRIPTIONS`, the README table, and the char/token counts here.
3. Re-check for new `registerTool`/`setActiveTools` calls upstream; if any appear, add tool capture (never publish upstream tools directly).
4. Run `npm run check` here.
5. Update the Versions sections.
