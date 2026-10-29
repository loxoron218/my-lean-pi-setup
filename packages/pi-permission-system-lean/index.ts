// pi-permission-system-lean — description-only facade over @gotgenes/pi-permission-system.
//
// Upstream 42.0.0 registers one slash command and zero tools, so there are no
// tool schemas to trim. The whole saving is in the command description:
// 61 chars upstream vs 39 here. The command name, handler, event
// subscriptions, and the entire permission-enforcement engine (per-turn tool
// hiding, allow/ask/deny gates, subagent forwarding, service publication) run
// the original upstream code untouched.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
// The upstream package's exports map only exposes "." (the cross-extension
// service surface), so the extension entry point is unreachable by package
// subpath. Reach it by file path instead: every lean package installs its own
// dependencies in its own node_modules (no workspaces), which keeps this
// relative import stable.
import upstreamActivate from "./node_modules/@gotgenes/pi-permission-system/src/index.ts";

const UPSTREAM_VERSION = "42.0.0";

type RegisterCommandOptions = Parameters<ExtensionAPI["registerCommand"]>[1];

// Trimmed per the lean rules: say each thing once. Keeps the nouns that say
// what the command configures (permission-system logging, yolo mode); drops
// the verb, the package-name prefix, and the generic "behavior".
export const LEAN_DESCRIPTIONS: Record<string, string> = {
  "permission-system": "Permission-system logging and yolo mode",
};

function capturePi(pi: ExtensionAPI): ExtensionAPI {
  return new Proxy(pi, {
    get(target, prop, receiver) {
      if (prop === "registerCommand") {
        return (name: string, options: RegisterCommandOptions) => {
          const description = LEAN_DESCRIPTIONS[name] ?? options.description;
          target.registerCommand(name, { ...options, description });
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export default function leanActivate(pi: ExtensionAPI): void {
  upstreamActivate(capturePi(pi));
}

export { UPSTREAM_VERSION };
