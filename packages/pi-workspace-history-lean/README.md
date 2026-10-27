# pi-workspace-history-lean

Based on [`pi-workspace-history`](https://github.com/wcldyx/pi-workspace-history) by [wcldyx](https://github.com/wcldyx), MIT-licensed (see LICENSE). Upstream is pinned to `0.5.2`.

A description-only lean wrapper: upstream registers five slash commands and **zero tools**, so there are no tool schemas to trim. This package re-registers the same five commands with shorter descriptions; names, handlers, events, and the footer status run the original upstream code untouched.

## Token numbers

Model-facing startup text is just the five command descriptions (no tools, no parameter schemas, no system-prompt additions). Tokens estimated as `ceil(characters / 4)`:

| Command | Upstream | Lean |
| --- | --- | --- |
| `/undo` | Undo last agent turn with optional workspace restore (52) | Undo last turn, optionally restoring files (42) |
| `/redo` | Redo previously undone navigation (33) | Redo the last undo (18) |
| `/checkpoint` | Save current workspace state as a manual time-machine checkpoint (64) | Save current files as a manual checkpoint (41) |
| `/diff` | Show the file changes made by the latest agent operation (/diff 2 for the one before) (85) | Show files changed by a recent operation (/diff 2 for earlier) (62) |
| `/history-status` | Show whether workspace history is active, where it is stored, and recent problems (81) | History status, storage path, and recent errors (47) |
| **Total** | **315 chars → 79 tokens** | **210 chars → 53 tokens** |

Saves **26 tokens (32.9% fewer)**. Absolute saving is small because upstream is already lean by construction — see MAINTENANCE.md.

## Installation

```bash
pi install npm:pi-workspace-history-lean
```

Do not load this alongside upstream `pi-workspace-history`; both register the same command names.

## Usage

Same five commands as upstream: `/undo`, `/redo`, `/checkpoint [label]`, `/diff [n]`, `/history-status`. Behavior is identical — only the `/help` descriptions are shorter.

## Versions

- Lean wrapper: `0.5.2`
- Upstream dependency is pinned to `pi-workspace-history@0.5.2`.

## Development

```bash
npm install
npm run check
```

## License

MIT. This project wraps the MIT-licensed [`pi-workspace-history`](https://github.com/wcldyx/pi-workspace-history) by wcldyx.
