// pi-system-prompt-lean — strip ls/grep/find mentions from pi core's prompt.
//
// Pi 1.3.0 builds two prompt fragments that name file tools:
// - tools section: bash snippet "Execute bash commands (ls, grep, find, etc.)"
//   (bashToolSystemPromptContribution.snippet)
// - rules section: "Use bash for file operations like ls, rg, find" (buildRules,
//   emitted exactly when bash is enabled without the grep/find/ls tools — i.e.
//   the lean `--exclude-tools grep,find,ls` setup).
// Neither has an opt-out, so this extension rewrites both on every run.
// No tools, commands, or skills. List AFTER all prompt-contributing extensions:
// a later full-prompt return would clobber this override.
import type { BeforeAgentStartEvent, ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const PI_VERSION = "1.3.0";
export const BASH_SNIPPET_SUFFIX = " (ls, grep, find, etc.)";
export const BASH_SNIPPET_CLEAN = "Execute bash commands";
export const FILE_OPS_RULE = "Use bash for file operations like ls, rg, find";
export const FILE_OPS_RULE_CLEAN = "Use bash for file operations";

// Pure rewrite, exported for tests. Removes only the two pinned phrases.
export function cleanPromptText(text: string): string {
  return text
    .replace(BASH_SNIPPET_CLEAN + BASH_SNIPPET_SUFFIX, BASH_SNIPPET_CLEAN)
    .replace(FILE_OPS_RULE, FILE_OPS_RULE_CLEAN);
}

export default function activate(pi: ExtensionAPI): void {
  pi.on("before_agent_start", async (event: BeforeAgentStartEvent) => {
    // Fix the stored options too, so transcript sections.tools rebuild clean
    // on subsequent tool changes. Guarded: snippet may be customized already.
    const snippets = event.systemPromptOptions.toolSnippets;
    if (typeof snippets?.["bash"] === "string" && snippets["bash"].includes(BASH_SNIPPET_SUFFIX)) {
      snippets["bash"] = cleanPromptText(snippets["bash"]);
    }
    // Fix the request head now. The rules bullet is auto-generated with no
    // opt-out, so only a full-prompt return removes it; pi projects it onto
    // the request while transcript sections keep evolving normally.
    const cleaned = cleanPromptText(event.systemPrompt);
    if (cleaned !== event.systemPrompt) return { systemPrompt: cleaned };
  });
}
