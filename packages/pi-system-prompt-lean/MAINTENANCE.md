# Maintenance

Upstream: [`@earendil-works/pi-coding-agent`](https://github.com/badlogic/pi-mono) core prompt, tracked via the pinned `devDependencies` entry `1.4.0` (exact pin; tests assert `PI_VERSION`). 1.4.0 kept both pinned phrases verbatim.

## What the patch does

- `before_agent_start` handler only. Mutates `event.systemPromptOptions.toolSnippets["bash"]` (guarded, idempotent) and returns `{ systemPrompt }` with both phrases stripped when present, `undefined` otherwise.
- Pinned strings: `Execute bash commands (ls, grep, find, etc.)` (`bashToolSystemPromptContribution.snippet`) and `Use bash for file operations like ls, rg, find` (`buildRules` fallback in `src/core/system-prompt.ts`). Tests pin both plus their char counts, so a core rewording fails loudly.

## Adaptation points

- `BeforeAgentStartEvent` shape (`systemPrompt` rendered string + mutable `systemPromptOptions`) and `BeforeAgentStartEventResult.systemPrompt` projection semantics in `_prepareRun` (`dist/core/agent-session.js`).
- Package must stay last among prompt-contributing extensions in `settings.json`.
- PowerShell rule variants name no tools and are deliberately left alone.

## Tracking a new pi-coding-agent version

1. Bump `version` and the pinned `devDependencies` entry together.
2. Re-grep `system-prompt.ts` for the snippet and the `buildRules` fallback; update constants, tests, and README numbers.
3. Re-check `BeforeAgentStartEvent`/`BeforeAgentStartEventResult` shapes and `_prepareRun` projection behavior.
4. Run `npm run check` here.
