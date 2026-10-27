# pi-context-view-lean

Based on [`pi-context-view`](https://github.com/dimk90/pi-context-view) by [Dmitry Makarov](https://github.com/dimk90), MIT-licensed (see LICENSE). Upstream is pinned to `0.8.0`.

A description-only lean wrapper: upstream registers one slash command and **zero tools**, so there are no tool schemas to trim. This package re-registers the same command with a shorter description; the name, handler, argument completions, events, and request capture run the original upstream code untouched.

## Token numbers

Model-facing startup text is just the command description (no tools, no parameter schemas, no system-prompt additions — upstream "adds nothing to the model context"). Tokens estimated as `ceil(characters / 4)`:

| Command | Upstream | Lean |
| --- | --- | --- |
| `/context` | [usage\|injections\|config] - Inspect context usage, injections (61) | [usage\|injections\|config] - Context usage and injections (56) |
| **Total** | **61 chars → 16 tokens** | **56 chars → 14 tokens** |

Saves **2 tokens (12.5% fewer)**. Absolute saving is small because upstream is already lean by construction — see MAINTENANCE.md.

## Installation

```bash
pi install npm:pi-context-view-lean
```

Do not load this alongside upstream `pi-context-view`; both register the same command name.

## Usage

Same command as upstream: `/context [usage|injections|config]`. Behavior is identical — only the `/help` description is shorter.

## Versions

- Lean wrapper: `0.8.0`
- Upstream dependency is pinned to `pi-context-view@0.8.0`.

## Development

```bash
npm install
npm run check
```

## License

MIT. This project wraps the MIT-licensed [`pi-context-view`](https://github.com/dimk90/pi-context-view) by Dmitry Makarov.
