# pi-usage-lean

Based on [`@narumitw/pi-usage`](https://github.com/narumiruna/pi-extensions) by [narumiruna](https://github.com/narumiruna), MIT-licensed (see LICENSE). Upstream is pinned to `0.67.0`.

A description-only lean wrapper: upstream registers two slash commands and **zero tools**, so there are no tool schemas to trim. This package re-registers the same two commands with shorter descriptions; names, handlers, events, and the usage statusline run the original upstream code untouched.

## Token numbers

Model-facing startup text is just the two command descriptions (no tools, no parameter schemas, no system-prompt additions). Tokens estimated as `ceil(characters / 4)`:

| Command | Upstream | Lean |
| --- | --- | --- |
| `/usage` | Show usage for the current runtime account (42) | Usage of current runtime account (32) |
| `/fast` | Toggle Codex Fast mode (22) | Toggle Codex Fast (17) |
| **Total** | **64 chars → 16 tokens** | **49 chars → 13 tokens** |

Saves **3 tokens (18.8% fewer)**. Absolute saving is tiny because upstream descriptions were already near-minimal — see MAINTENANCE.md.

## Installation

```bash
pi install npm:pi-usage-lean
```

Do not load this alongside upstream `@narumitw/pi-usage`; both register the same command names.

## Usage

Same two commands as upstream: `/usage`, `/fast`. Behavior is identical — only the `/help` descriptions are shorter.

## Versions

- Lean wrapper: `0.67.0`
- Upstream dependency is pinned to `@narumitw/pi-usage@0.67.0`.

## Development

```bash
npm install
npm run check
```

## License

MIT. This project wraps the MIT-licensed [`@narumitw/pi-usage`](https://github.com/narumiruna/pi-extensions) by narumiruna.
