# Maintenance — pi-permission-system-lean

Upstream: [`@gotgenes/pi-permission-system`](https://github.com/gotgenes/pi-packages/tree/main/packages/pi-permission-system) by [Chris Lasher](https://github.com/gotgenes) (MIT).
Pinned upstream dependency: `41.0.0` (verified latest on 2026-10-27 via `npm view`).

## What this facade does

Upstream registers one slash command and **zero tools**, so there is no tool
schema to trim — same situation as `pi-usage-lean`. The only static
model-facing text is the command description, which the Proxy in `index.ts`
swaps at `registerCommand` time. Names, handlers, event subscriptions, and the
permission-enforcement engine run the original upstream code untouched.

| Command | Upstream (41.0.0) | Lean |
| --- | --- | --- |
| `/permission-system` | Configure pi-permission-system logging and yolo-mode behavior (61) | Permission-system logging and yolo mode (39) |

Saves 22 chars ≈ 6 tokens (`ceil(chars/4)`), ~37% of this package's tiny
model-facing surface.

## Upstream internals depended on

- Command name `permission-system` and the `registerCommand` signature.
- Entry `./src/index.ts` default export reached **by file path**, not package
  subpath: the upstream exports map only exposes `"."` (the cross-extension
  service surface), so `@gotgenes/pi-permission-system/src/index.ts` throws
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. The relative `./node_modules/...` import is
  stable because this repo installs each lean package's dependencies in its own
  `node_modules` (no workspaces).
- `tsconfig.json` `paths` for `#src/*` mirrors the upstream tsconfig (upstream
  `tsc` resolves those via `paths`, not via `package.json` `imports`).
- Upstream registers **zero tools**: tests assert `registerTool` is never
  called and activation never calls `setActiveTools` (per-turn tool hiding
  happens inside the `before_agent_start` handler — narrowing is the feature,
  so the facade must keep passing it through).
- `pi.events` is passed by reference so the `@gotgenes/pi-subagents` child
  lifecycle subscriptions (`session-created`/`bound`/`disposed`) work.
- Tests pin the upstream description string, so any upstream rewording fails
  loudly here instead of silently changing the trim.

Out of scope: trimming the `/permission-system` argument-completion labels
(shown on demand, not at startup) and the dynamic per-turn enforcement output
(the hiding itself saves tokens and is the point of the extension).

## Upgrading the upstream pin

1. `npm view @gotgenes/pi-permission-system version` and set the exact version
   in `package.json` (`dependencies`) and this file.
2. `npm install` in this directory, then `npm run check`.
3. If a test fails: a new/renamed command means updating `LEAN_DESCRIPTIONS`
   and the token table above; a new `registerTool` upstream means growing
   tool-capture here (see `pi-plan-mode-lean`) instead of publishing the tool.
4. If upstream ever ships compiled `dist` JS, prefer importing that over
   `./node_modules/.../src/index.ts`.
