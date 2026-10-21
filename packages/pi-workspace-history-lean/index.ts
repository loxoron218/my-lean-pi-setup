// pi-workspace-history-lean — description-only facade over pi-workspace-history.
//
// Upstream 0.5.0 registers five slash commands and zero tools, so there are no
// tool schemas to trim. The whole saving is in the five command descriptions:
// 315 chars upstream vs 210 here. Command names, handlers, events, and the
// footer status all run the original upstream code untouched.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import upstreamActivate from "pi-workspace-history/.pi/extensions/workspace-history.ts";

const UPSTREAM_VERSION = "0.5.0";

type RegisterCommandOptions = Parameters<ExtensionAPI["registerCommand"]>[1];

// Trimmed per the lean rules: say each thing once, keep the calling convention
// (/diff [n]) that affects how the model invokes the command.
export const LEAN_DESCRIPTIONS: Record<string, string> = {
  undo: "Undo last turn, optionally restoring files",
  redo: "Redo the last undo",
  checkpoint: "Save current files as a manual checkpoint",
  diff: "Show files changed by a recent operation (/diff 2 for earlier)",
  "history-status": "History status, storage path, and recent errors",
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
