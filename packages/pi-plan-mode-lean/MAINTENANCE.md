# Maintenance

Upstream: [`@narumitw/pi-plan-mode`](https://github.com/narumiruna/pi-plan-mode), pinned to `0.59.4` in `dependencies` (exact pin; the setup benchmark test enforces it).

## What the facade does

- Runs the upstream extension with a capturing `pi` proxy: `registerTool` calls are collected, never published; `setActiveTools` is blocked; everything else (`/plan` command, events, shortcuts, model settings) passes through bound.
- Registers one `plan` tool (`op`: `question` | `complete` | `help`) whose payload schemas are the upstream schemas minus prose `description` fields. Names, types, `required`, and `min/max` are unchanged.
- `prepareArguments` fills an omitted `op` only when the payload names exactly one tool (`plan` string → `complete`, `questions` array → `question`).
- `getActiveTools` reports both helper names as active (they are callable through `plan`) so the upstream start gate passes; the tools stay unregistered, so the model prompt and launch menus never show them.
- `tool_call` subscriptions are wrapped: a `plan` call is presented to upstream under the helper name its op routes to, giving it the exact required-helper carve-out in the Plan policy voter. Other events pass through untouched.
- `execute` routes to the captured upstream tool with only its payload key, so a mismatched payload fails with the upstream field error. `op: help` returns both full upstream descriptions and schemas.
- `renderResult` delegates to the upstream completion Markdown renderer.

## Tracking a new upstream version

1. Bump `version` and the pinned `dependencies` entry together; keep them equal (first lean release per upstream).
2. Re-check the upstream tool list: any new tool must be captured (never registered) and either routed via a new `op` or deliberately hidden in `op: help` — document the choice here.
3. Re-check upstream `registerTool` parameters for new prose or constraints and mirror them (minus prose).
4. Run `npm run check` here, then `npm run benchmark` in `../../my-lean-pi-setup` to refresh `benchmarks/results.json` and all README blocks.
5. Update the Versions sections in both READMEs.

## Benchmark

Measured by `scripts/benchmark-extensions.mjs` in `my-lean-pi-setup`: Pi 1.3.0 in separate temporary processes, only the extension under test enabled, tokens estimated as `ceil(characters / 4)`. Numbers in both READMEs are auto-generated — do not hand-edit between the markers.
