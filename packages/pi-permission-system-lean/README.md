# pi-permission-system-lean

Based on [`@gotgenes/pi-permission-system`](https://github.com/gotgenes/pi-packages/tree/main/packages/pi-permission-system) by [Chris Lasher](https://github.com/gotgenes), MIT-licensed (see LICENSE). Upstream is pinned to `42.0.0`.

A description-only lean wrapper: upstream registers one slash command and **zero tools**, so there are no tool schemas to trim. This package re-registers the same command with a shorter description; the name, handler, events, and the whole permission-enforcement engine (per-turn tool hiding, allow/ask/deny gates, subagent forwarding) run the original upstream code untouched.

## Token numbers

Model-facing startup text is just the one command description (no tools, no parameter schemas, no system-prompt additions). Tokens estimated as `ceil(characters / 4)`:

| Command | Upstream | Lean |
| --- | --- | --- |
| `/permission-system` | Configure pi-permission-system logging and yolo-mode behavior (61) | Permission-system logging and yolo mode (39) |
| **Total** | **61 chars → 16 tokens** | **39 chars → 10 tokens** |

Saves **6 tokens (37.5% fewer)**. Absolute saving is small because upstream's only model-facing surface is a single description — see MAINTENANCE.md. The real token win of this extension is dynamic: fully-denied tools stay hidden from the model every turn.

## Installation

```bash
pi install npm:pi-permission-system-lean
```

Do not load this alongside upstream `@gotgenes/pi-permission-system`; both register the same command name.

## Usage

Same command as upstream: `/permission-system` (configure logging and yolo mode, or `show`/`path`/`reset`/`help`). Behavior is identical — only the `/help` description is shorter.

## Versions

- Lean wrapper: `42.0.0`
- Upstream dependency is pinned to `@gotgenes/pi-permission-system@42.0.0`.

## Development

```bash
npm install
npm run check
```

## License

MIT. This project wraps the MIT-licensed [`@gotgenes/pi-permission-system`](https://github.com/gotgenes/pi-packages/tree/main/packages/pi-permission-system) by Chris Lasher.
