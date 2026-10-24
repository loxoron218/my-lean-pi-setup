# ponytail-lean

Based on [`@dietrichgebert/ponytail`](https://github.com/DietrichGebert/ponytail) by [Dietrich Gebert](https://github.com/DietrichGebert), MIT-licensed (see LICENSE). Upstream is pinned to `5.3.2`.

A full-only lean wrapper: upstream registers six slash commands (`/ponytail` plus five `/ponytail-*` aliases), ships six skills, and injects a mode-dependent prompt every turn (lite/full/ultra/off/review). This package keeps exactly one thing — **the default full-mode prompt, verbatim, on every turn** — and drops everything else: zero commands, zero tools, zero skills, no mode state, no status indicator, no startup toast. The prompt text is built by the upstream instruction builder at runtime, so it follows the pinned dependency without copying it here.

## Token numbers

Per-turn prompt text is identical to upstream's default state (upstream resolves to full with no config), so the harness `promptDelta` is equal by design: **715 tokens both ways**. The saving is the always-on startup surface, which this package removes entirely. Tokens estimated as `ceil(characters / 4)`:

| Startup surface | Upstream | Lean |
| --- | --- | --- |
| Command descriptions (6 commands) | 186 chars → 47 tokens | 0 |
| Skill-frontmatter descriptions (6 skills) | 1340 chars → 335 tokens | 0 (ships no skills) |
| **Total startup** | **1526 chars → 382 tokens** | **0** |
| Per-turn prompt (`before_agent_start`) | 2859 chars → 715 tokens (full) | 2859 chars → 715 tokens (identical) |

Upstream per-mode prompt sizes for reference: full 2859, lite 2914, ultra 2928, off 2817, review 81 chars. Lean always injects the 2859-char full text, ignoring `PONYTAIL_DEFAULT_MODE`, the config file, and stored session modes.

## Installation

```bash
pi install npm:ponytail-lean
```

Do not load this alongside upstream `@dietrichgebert/ponytail`; both inject the `ponytail` system-prompt section. There is nothing to switch and no off state — uninstall the package to stop the prompt.

## Usage

No commands. Every agent turn carries the full ponytail ruleset in the `ponytail` system-prompt section. The dropped `/ponytail-*` skills (review, audit, gain, debt, help) and the lite/ultra levels are intentionally unavailable.

## Versions

- Lean wrapper: `5.3.2-lean.1`
- Upstream dependency is pinned to `@dietrichgebert/ponytail@5.3.2`.

## Development

```bash
npm install
npm run check
```

## License

MIT. This project wraps the MIT-licensed [`@dietrichgebert/ponytail`](https://github.com/DietrichGebert/ponytail) by Dietrich Gebert.
