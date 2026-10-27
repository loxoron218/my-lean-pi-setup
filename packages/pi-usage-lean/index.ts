// pi-usage-lean — description-only facade over @narumitw/pi-usage.
//
// Upstream 0.68.3 registers two slash commands and zero tools, so there are no
// tool schemas to trim. The whole saving is in the two command descriptions:
// 64 chars upstream vs 49 here. Command names, handlers, events, and the usage
// statusline all run the original upstream code untouched.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import upstreamActivate from "@narumitw/pi-usage/dist/index.ts";

const UPSTREAM_VERSION = "0.68.3";

type RegisterCommandOptions = Parameters<ExtensionAPI["registerCommand"]>[1];

// Trimmed per the lean rules: say each thing once. Both entries keep the nouns
// that affect how the model invokes the command (runtime account, Codex Fast).
export const LEAN_DESCRIPTIONS: Record<string, string> = {
  usage: "Usage of current runtime account",
  fast: "Toggle Codex Fast",
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
