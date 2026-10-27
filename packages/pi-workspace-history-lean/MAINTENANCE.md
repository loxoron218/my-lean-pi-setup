# Maintenance

Upstream: [`pi-workspace-history`](https://github.com/wcldyx/pi-workspace-history), pinned to `0.5.2` in `dependencies` (exact pin; the tests enforce the command list and the pinned descriptions). 0.5.1/0.5.2 only reworked `/diff` rendering (line numbers, word highlights, wrapping) with no command-surface change.

## What the facade does

- Runs the upstream extension with a capturing `pi` proxy: `registerCommand` calls are intercepted and re-registered under the same name with the same options object except a shorter `description`; the `handler` (and any `getArgumentCompletions`) is the original upstream function reference.
- Everything else passes through bound: all `on(...)` event subscriptions (session/turn/tree lifecycle that drives the snapshots), `appendEntry`, `exec`, `setStatus`, and so on.
- Nothing is merged and nothing is hidden: upstream registers zero tools and five commands, so there is no `op` router and no `help` op. The full upstream descriptions are recorded in `tests/lean.test.mjs` (`EXPECTED_UPSTREAM_DESCRIPTIONS`) and in the README table.

## Trimmed per command

- `undo`: "Undo last agent turn with optional workspace restore" → "Undo last turn, optionally restoring files". Keeps the files-vs-conversation choice the handler asks about.
- `redo`: "Redo previously undone navigation" → "Redo the last undo".
- `checkpoint`: "Save current workspace state as a manual time-machine checkpoint" → "Save current files as a manual checkpoint".
- `diff`: "Show the file changes made by the latest agent operation (/diff 2 for the one before)" → "Show files changed by a recent operation (/diff 2 for earlier)". Keeps the `[n]` calling convention.
- `history-status`: "Show whether workspace history is active, where it is stored, and recent problems" → "History status, storage path, and recent errors".

## Upstream internals this depends on

- Command names: `undo`, `redo`, `checkpoint`, `diff`, `history-status`. A rename/add/remove breaks the "exactly the upstream commands" test on purpose.
- `registerCommand(name, options)` signature with `{ description, handler }`; options are spread through, so added option fields survive automatically.
- Upstream calls no `registerTool` and no `setActiveTools`; the "never touches tools" test pins that. If a future upstream adds tools, this wrapper must grow a tool-capturing facade (see `pi-plan-mode-lean` for the pattern) instead of silently publishing them.
- Typecheck pins `@earendil-works/pi-coding-agent`/`pi-tui` devDeps at `1.0.4` (upstream's own versions); newer majors changed event types upstream relies on.

## Tracking a new upstream version

1. Bump `version` and the pinned `dependencies` entry together; keep them equal.
2. Re-check the upstream command list: any added/removed/renamed command or reworded description fails the tests — update `LEAN_DESCRIPTIONS`, the README table, and the char/token counts here.
3. Re-check for new `registerTool`/`setActiveTools` calls upstream; if any appear, add tool capture (never publish upstream tools directly).
4. Run `npm run check` here.
5. Update the Versions sections.
