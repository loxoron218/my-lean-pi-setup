# pi-zentui-lean

Based on [`pi-zentui`](https://github.com/lmilojevicc/pi-zentui) by [lmilojevicc](https://github.com/lmilojevicc), MIT-licensed (see LICENSE). Upstream is pinned to `0.32.0`.

A description-only lean wrapper: upstream registers one slash command and **zero tools**, so there are no tool schemas to trim. This package re-registers the same command with a shorter description; name, handler, argument completions, events, and all TUI surfaces run the original upstream code untouched.

## Token numbers

Model-facing startup text is just the one command description (no tools, no parameter schemas, no system-prompt additions). Tokens estimated as `ceil(characters / 4)`:

| Command | Upstream | Lean |
| --- | --- | --- |
| `/zentui` | Configure Zentui (16) | Zentui (6) |
| **Total** | **16 chars → 4 tokens** | **6 chars → 2 tokens** |

Saves **2 tokens (50% fewer)**. Absolute saving is tiny because the upstream description was already near-minimal and there are no tools — see MAINTENANCE.md.

## Installation

```bash
pi install npm:pi-zentui-lean
```

Do not load this alongside upstream `pi-zentui`; both register the same command name.

## Usage

Same command as upstream: `/zentui`. Behavior is identical — only the `/help` description is shorter.

## Versions

- Lean wrapper: `0.32.0`
- Upstream dependency is pinned to `pi-zentui@0.32.0`.

## Development

```bash
npm install
npm run check
```

## License

MIT. This project wraps the MIT-licensed [`pi-zentui`](https://github.com/lmilojevicc/pi-zentui) by lmilojevicc.
