# Maintenance

Upstream: [`pi-deep-research`](https://github.com/fank/pi-deep-research), pinned to `0.4.1` in `dependencies` (exact pin; the setup benchmark test enforces it).

Upstream also needs `@sinclair/typebox` at runtime (its schemas are built with it) but declares it only as a devDependency. The pi host provides it through the extension loader, so this package declares `@sinclair/typebox: *` in `peerDependencies` (a copy in `dependencies` is rejected by the loader: it would bypass the loader and risk duplicate runtime modules). It is additionally pinned in `devDependencies` so the local `npm run check` can load the upstream entrypoint in tests.

## What the facade does

- Runs the upstream extension with a capturing `pi` proxy: `registerTool` calls are collected, never published; `setActiveTools` is blocked; everything else passes through bound. Activation is awaited (upstream `activate` is async).
- Registers one `research` tool (`op`: `search` | `extract` | `checkpoint` | `help`) whose payload schemas are the upstream schemas minus prose `description` fields. Names, types, `required`, `maxItems`, `default`, and `maximum` are unchanged.
- `prepareArguments` fills an omitted `op` only when the payload names exactly one tool (`query`/`queries` → `search`, `url` string → `extract`, any checkpoint field → `checkpoint`).
- `options` is a JSON-string field for the rare upstream parameters: `search_depth`, `include_domains`, `exclude_domains` (search) and `contradictions`, `gaps` (checkpoint). Unknown keys and non-object payloads fail loudly instead of being silently dropped.
- `execute` routes to the captured upstream tool with only its payload key, so a mismatched payload fails with the upstream error. `op: help` returns all three full upstream descriptions and schemas plus the `options` key list.

## Shipped workflow assets (adapted copies, not code)

- `pi-deep-research/SKILL.md`, `references/report-template.md`: verbatim upstream copies except mechanical tool-name renames (`web_search` → `research` op `search`, `web_extract` → `research` op `extract`, `research_checkpoint` → `research` op `checkpoint`). Upstream prose is untouched.
- `references/config.md`: verbatim copy (no tool references).
- `prompts/research.md` (the `/research` command): verbatim body; only the frontmatter `description` is trimmed to `[depth] topic - deep web research (quick|standard|deep|exhaustive)`.
- Registered via the `pi` manifest key (`extensions`, `skills`, `prompts`) mirroring the upstream package shape. The skill keeps its upstream on-demand trigger — it is not part of startup cost.

## Typecheck note

`upstream.d.ts` (wired via tsconfig `paths`) types the upstream TS entrypoint without loading its sources into `tsc`: upstream ships no bundled types and its sources are not clean under this package's NodeNext + strict config. At runtime the real `extension.ts` resolves normally (pi's loader, jiti in tests). If the facade's import ever stops matching the upstream export shape, the checkpoint/search/extract tests fail first.

## Tracking a new upstream version

1. Bump `version` and the pinned `dependencies` entry together; keep them equal (first lean release per upstream).
2. Re-check the upstream tool list: any new tool must be captured (never registered) and either routed via a new `op` or deliberately hidden in `op: help` — document the choice here.
3. Re-check upstream `registerTool` parameters for new prose or constraints and mirror them (minus prose); same for new rare fields in `options`.
4. Re-diff `SKILL.md`, `prompts/research.md`, `references/` against upstream and re-apply only the mechanical renames; record any new adaptation here.
5. Run `npm run check` here, then `npm run benchmark` in `../../my-lean-pi-setup` to refresh `benchmarks/results.json` and all README blocks.
6. Update the Versions sections in both READMEs.

## Benchmark

Measured by `scripts/benchmark-extensions.mjs` in `my-lean-pi-setup`: Pi 1.3.0 in separate temporary processes, only the extension under test enabled, tokens estimated as `ceil(characters / 4)`. Numbers in both READMEs are auto-generated — do not hand-edit between the markers.
