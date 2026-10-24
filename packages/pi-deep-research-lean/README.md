# pi-deep-research-lean

<!-- token-benchmark:summary:start -->
> **Token benchmark: Lean 250, upstream `pi-deep-research@0.4.1` 776 — 67.8% fewer.**
<!-- token-benchmark:summary:end -->
> More lean extensions in the [my-lean-pi-setup monorepo](https://github.com/loxoron218/my-lean-pi-setup)

[简体中文](./README_zh-CN.md)

A lightweight Pi wrapper for [`pi-deep-research`](https://github.com/fank/pi-deep-research). It preserves the complete deep-research engine while drastically reducing startup token overhead: upstream's three tools (`web_search`, `web_extract`, `research_checkpoint`) are merged into a single `research` tool with `op` `search` | `extract` | `checkpoint` | `help`.

## Context Footprint Benchmark

<!-- token-benchmark:benchmark:start -->
With only this extension enabled, its recurring model-facing initialization contribution is:

| Variant | Tool and prompt contribution | Total |
| --- | --- | ---: |
| Lean `pi-deep-research-lean@0.4.1` | `research` (250) | **250** |
| Upstream `pi-deep-research@0.4.1` | `web_search` (234) + `web_extract` (104) + `research_checkpoint` (438) | **776** |

This saves **526 tokens (67.8%)**.
Measured with Pi 1.3.0 in separate temporary processes with empty working directories and configuration. Built-in tools, skills, context files, session history, user messages, unrelated extensions, runtime UI, and slash commands are excluded; `before_agent_start` additions are included. Tokens are a fixed character-proxy estimate using `ceil(characters / 4)`, not provider tokenizer billing.
<!-- token-benchmark:benchmark:end -->

## Core Features

* Same research engine: The upstream extension runs untouched behind the facade — provider chain (Tavily / Brave), extraction, and the CONTINUE/PROCEED checkpoint gate are unchanged.
* One tool instead of three: `op: search` finds sources, `op: extract` reads a page in full, `op: checkpoint` submits progress for a verdict. The `op` is inferred from the payload when unambiguous.
* Full schemas on demand: `op: help` returns all three complete upstream descriptions and parameter schemas.
* Rare options stay available: `search_depth` / domain filters (search) and `contradictions` / `gaps` (checkpoint) pass through as a JSON-string `options` field; common fields stay typed.
* Stable tool list: Upstream tools are never registered and the active tool set is never changed, so prompt caching stays intact.
* Same workflow assets: the `pi-deep-research` skill, the `/research` command, and the report template ship with only tool-name references adapted (`research_checkpoint` → `research` op `checkpoint`).

## Installation

```bash
pi install npm:pi-deep-research-lean
```

Do not load this alongside another `pi-deep-research` wrapper to avoid registering duplicate tools.

## Usage

The model interacts with a single tool:

```text
research
```

Search with `op: search` plus `query`/`queries`, read a promising result with `op: extract` plus `url`, and after each search round submit progress with `op: checkpoint` — obeying the CONTINUE/PROCEED verdict before reporting, exactly as the upstream tool requires.

## Versions

- Lean wrapper: `0.4.1`
- Upstream dependency is pinned to `pi-deep-research@0.4.1`.

## Development

```bash
npm install
npm run check
```

## License

MIT. This project wraps the MIT-licensed [`pi-deep-research`](https://github.com/fank/pi-deep-research).
