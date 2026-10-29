// pi-context-view-lean — description-only facade over pi-context-view.
//
// Upstream 0.8.1 registers one slash command and zero tools, so there are no
// tool schemas to trim. The whole saving is in the command description:
// 61 chars upstream vs 56 here. The command name, handler, argument
// completions, events, and request capture run the original upstream code untouched.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import upstreamActivate from "pi-context-view/src/index.ts";

const UPSTREAM_VERSION = "0.8.1";

type RegisterCommandOptions = Parameters<ExtensionAPI["registerCommand"]>[1];

// Trimmed per the lean rules: say each thing once ("Inspect" adds nothing the
// hint doesn't already promise). Keeps the calling convention
// ([usage|injections|config]) that affects how the model invokes the command.
export const LEAN_DESCRIPTIONS: Record<string, string> = {
	context: "[usage|injections|config] - Context usage and injections",
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
