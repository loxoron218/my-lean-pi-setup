// pi-zentui-lean — description-only facade over pi-zentui.
//
// Upstream 0.32.0 registers one slash command and zero tools, so there are no
// tool schemas to trim. The whole saving is in the one command description:
// 16 chars upstream vs 6 here. The command name, handler, argument
// completions, events, entry renderer, and all TUI surfaces run the original
// upstream code untouched.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import upstreamActivate from "pi-zentui/extensions/zentui/index.ts";

const UPSTREAM_VERSION = "0.32.0";

type RegisterCommandOptions = Parameters<ExtensionAPI["registerCommand"]>[1];

// Trimmed per the lean rules: say each thing once. The /zentui settings panel
// already names every section, so the bare brand is enough to find it.
export const LEAN_DESCRIPTIONS: Record<string, string> = {
  zentui: "Zentui",
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
