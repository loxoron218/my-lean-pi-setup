# pi-system-prompt-lean

Prompt patch for [Pi](https://github.com/badlogic/pi-mono) core: removes the two `ls`/`grep`/`find` mentions from the initial system prompt, so the model stops reaching for native file tools that the lean setup excludes.

Pi 1.3.0 hardcodes both phrases with no opt-out:

- tools section: `- bash: Execute bash commands (ls, grep, find, etc.)`
- rules section: `- Use bash for file operations like ls, rg, find` (emitted exactly when `bash` is enabled without the `grep`/`find`/`ls` tools — i.e. `--exclude-tools grep,find,ls`)

The extension rewrites both on every `before_agent_start`: the bash snippet in the stored prompt options (transcript sections rebuild clean) plus a full-prompt return for the auto-generated rules bullet (projected onto the request; transcript sections keep evolving normally). No tools, commands, or skills.

## Install

List it **after** all prompt-contributing extensions — a later full-prompt return would clobber this override:

```json
{ "source": "npm:@ssk_dev/pi-system-prompt-lean@1.3.0" }
```

## Savings

Hand-counted (`ceil(chars / 4)`): ` (ls, grep, find, etc.)` is 23 chars (~6 tokens), ` like ls, rg, find` is 18 chars (~5 tokens) — about **11 tokens on every request**, permanently. Registers no tools, so the tool benchmark does not apply.

## Tracking upstream

See [MAINTENANCE.md](./MAINTENANCE.md). Targets `pi-coding-agent` 1.3.0 (devDependency pin).

## License

MIT. Upstream prompt strings © Mario Zechner / Earendil Works; see [LICENSE](./LICENSE).
