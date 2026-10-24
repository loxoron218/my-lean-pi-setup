# @ssk_dev/pi-plan-mode-lean

<!-- token-benchmark:summary:start -->
> **Token benchmark: Lean 227, upstream `@narumitw/pi-plan-mode@0.59.4` 480 — 52.7% fewer.**
<!-- token-benchmark:summary:end -->
> More lean extensions in the [my-lean-pi-setup monorepo](https://github.com/loxoron218/my-lean-pi-setup)

[简体中文](./README_zh-CN.md)

A lightweight Pi wrapper for [`@narumitw/pi-plan-mode`](https://github.com/narumiruna/pi-plan-mode). It preserves the complete Plan-mode engine while drastically reducing startup token overhead: upstream's two tools (`plan_mode_question`, `plan_mode_complete`) are merged into a single `plan` tool with `op` `question` | `complete` | `help`.

## Context Footprint Benchmark

<!-- token-benchmark:benchmark:start -->
With only this extension enabled, its recurring model-facing initialization contribution is:

| Variant | Tool and prompt contribution | Total |
| --- | --- | ---: |
| Lean `pi-plan-mode-lean@0.59.4-lean.1` | `plan` (227) | **227** |
| Upstream `@narumitw/pi-plan-mode@0.59.4` | `plan_mode_question` (343) + `plan_mode_complete` (137) | **480** |

This saves **253 tokens (52.7%)**.
Measured with Pi 1.3.0 in separate temporary processes with empty working directories and configuration. Built-in tools, skills, context files, session history, user messages, unrelated extensions, runtime UI, and slash commands are excluded; `before_agent_start` additions are included. Tokens are a fixed character-proxy estimate using `ceil(characters / 4)`, not provider tokenizer billing.
<!-- token-benchmark:benchmark:end -->

## Core Features

* Same Plan-mode engine: The upstream extension runs untouched behind the facade — `/plan` command, menus, UI flows, validation, and completion rendering are unchanged.
* One tool instead of two: `op: question` asks 1–3 structured questions, `op: complete` submits the decision-ready plan alone as the final action. The `op` is inferred from the payload when unambiguous.
* Full schemas on demand: `op: help` returns both complete upstream descriptions and parameter schemas.
* Stable tool list: Upstream tools are never registered and the active tool set is never changed, so prompt caching stays intact.

## Installation

```bash
pi install npm:pi-plan-mode-lean
```

Do not load this alongside another `pi-plan-mode` wrapper to avoid registering duplicate tools.

## Usage

The model interacts with a single tool:

```text
plan
```

Ask structured questions with `op: question` plus the `questions` array, or submit the decision-ready plan with `op: complete` plus `plan` (Markdown, 1–50,000 characters) — alone as the final action, exactly as the upstream tools require. Both ops only apply while the Plan contract says `/plan` mode is active.

## Versions

- Lean wrapper: `0.59.4-lean.1`
- Upstream dependency is pinned to `@narumitw/pi-plan-mode@0.59.4`.

## Development

```bash
npm install
npm run check
```

## License

MIT. This project wraps the MIT-licensed [`@narumitw/pi-plan-mode`](https://github.com/narumiruna/pi-plan-mode).
