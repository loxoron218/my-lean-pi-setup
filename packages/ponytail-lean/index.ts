// ponytail-lean — always-on full-mode facade over @dietrichgebert/ponytail.
//
// Upstream 5.3.2 registers six slash commands (/ponytail plus five
// /ponytail-* aliases), ships six skills, and injects a mode-dependent prompt
// on every turn (lite/full/ultra/off/review selected via env, config file,
// session entries, and chat input). This wrapper keeps exactly one thing: the
// default full-mode prompt, verbatim, on every turn. No commands, no tools,
// no skills, no mode state, no status indicator, no startup toast.
// The prompt text is produced by the upstream instruction builder at runtime,
// so it follows the pinned dependency without copying it here.
import type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
  ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const UPSTREAM_VERSION = "5.3.2";

const require = createRequire(import.meta.url);

// The upstream package.json `exports` map only exposes "." and "./plugin"
// (both resolve to the OpenCode plugin), so deep specifier imports of the
// hooks fail with ERR_PACKAGE_PATH_NOT_EXPORTED. Resolve the package root
// through the exported entry instead, then require the hook file by absolute
// path, which bypasses the exports map. Pinned by tests: entry depth
// (.opencode/plugins/ponytail.mjs) and the hook path/name below.
//
// Pi's extension loader cannot resolve the bare package root this way
// ("Cannot find module '@dietrichgebert/ponytail'"), so fall back to
// locating the installed dependency on disk relative to this module.
function resolveUpstreamRoot(): string {
  try {
    return path.dirname(
      path.dirname(path.dirname(require.resolve("@dietrichgebert/ponytail"))),
    );
  } catch {
    // Pi loader: bare-root resolution unsupported — find it on disk instead.
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  let dir = here;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(
      dir,
      "node_modules",
      "@dietrichgebert",
      "ponytail",
    );
    if (existsSync(path.join(candidate, "package.json"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(here, "node_modules", "@dietrichgebert", "ponytail");
}

const upstreamRoot = resolveUpstreamRoot();

interface InstructionBuilder {
  getPonytailInstructions: (mode: string) => string;
}

const { getPonytailInstructions } = require(
  path.join(upstreamRoot, "hooks", "ponytail-instructions.js"),
) as InstructionBuilder;

// The single behavior this package keeps: upstream's full-mode text, exactly
// as upstream builds it (SKILL.md filtered to the full level). Reads the
// file on every turn like upstream does, so edits under node_modules show up
// without a restart.
export function fullInstructions(): string {
  return getPonytailInstructions("full");
}

export default function leanActivate(pi: ExtensionAPI): void {
  pi.on("before_agent_start", async (event) => {
    const instructions = fullInstructions();
    // Same injection order as upstream: structured sections first (keeps the
    // cached prefix when other extensions change their own section), then the
    // legacy whole-prompt fallbacks. Upstream clears sections.ponytail when
    // off; lean has no off state, so it only sets.
    const sections = event?.systemPromptOptions?.sections;
    if (sections && typeof sections === "object") {
      sections.ponytail = instructions;
      return;
    }
    const current = (event as BeforeAgentStartEvent | undefined)?.systemPrompt;
    if (Array.isArray(current)) {
      // OMP shape: the system prompt is an array of parts; keep it one.
      return { systemPrompt: [...current, instructions] } as unknown as BeforeAgentStartEventResult;
    }
    const base = typeof current === "string" && current ? `${current}\n\n` : "";
    return { systemPrompt: `${base}${instructions}` };
  });
}
