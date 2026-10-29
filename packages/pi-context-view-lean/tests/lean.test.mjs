import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { default: leanActivate, LEAN_DESCRIPTIONS } = await jiti.import("../index.ts");
const { default: upstreamActivate } = await jiti.import("pi-context-view/src/index.ts");

// Pinned upstream command description (pi-context-view@0.8.1). If upstream
// rewords it, this fails on purpose: update the trim mapping and MAINTENANCE.md.
const EXPECTED_UPSTREAM_DESCRIPTIONS = {
	context: "[usage|injections|config] - Inspect context usage, injections",
};

const tokens = (chars) => Math.ceil(chars / 4);

function stubPi() {
	const calls = { commands: [], handlers: [], tools: [], activeSet: [] };
	const noop = () => undefined;
	const pi = new Proxy(
		{},
		{
			get(_t, p) {
				if (p === "registerCommand")
					return (name, options) => {
						calls.commands.push([name, options]);
					};
				if (p === "registerTool")
					return (tool) => {
						calls.tools.push(tool);
					};
				if (p === "setActiveTools")
					return (names) => {
						calls.activeSet.push(names);
					};
				if (p === "on")
					return (event, handler) => {
						calls.handlers.push([event, handler]);
						return noop;
					};
				if (p === "then") return undefined;
				return noop;
			},
		},
	);
	return { pi, calls };
}

function activateInto(activate) {
	const { pi, calls } = stubPi();
	activate(pi);
	return calls;
}

const asMap = (calls) => Object.fromEntries(calls.commands);

describe("command surface", () => {
	it("registers exactly the upstream commands, no more, no fewer", () => {
		const lean = activateInto(leanActivate);
		const upstream = activateInto(upstreamActivate);
		assert.deepEqual(
			lean.commands.map(([name]) => name).sort(),
			upstream.commands.map(([name]) => name).sort(),
		);
		assert.deepEqual(
			lean.commands.map(([name]) => name).sort(),
			["context"],
		);
	});

	it("pins the upstream descriptions it trims", () => {
		const upstream = activateInto(upstreamActivate);
		assert.deepEqual(
			Object.fromEntries(upstream.commands.map(([name, options]) => [name, options.description])),
			EXPECTED_UPSTREAM_DESCRIPTIONS,
		);
	});

	it("swaps in a shorter lean description (61 chars/16 tok -> 56 chars/14 tok)", () => {
		const lean = activateInto(leanActivate);
		assert.deepEqual(
			Object.fromEntries(lean.commands.map(([name, options]) => [name, options.description])),
			LEAN_DESCRIPTIONS,
		);
		const chars = (map) => Object.values(map).join("").length;
		const upstreamChars = chars(EXPECTED_UPSTREAM_DESCRIPTIONS);
		const leanChars = chars(LEAN_DESCRIPTIONS);
		assert.equal(upstreamChars, 61);
		assert.equal(leanChars, 56);
		assert.ok(leanChars < upstreamChars);
		assert.deepEqual([tokens(upstreamChars), tokens(leanChars)], [16, 14]);
	});

	it("keeps the upstream handler and completions untouched", () => {
		const lean = asMap(activateInto(leanActivate));
		const upstream = asMap(activateInto(upstreamActivate));
		for (const name of Object.keys(upstream)) {
			assert.equal(typeof lean[name].handler, "function");
			assert.equal(lean[name].handler.toString(), upstream[name].handler.toString());
			assert.equal(lean[name].getArgumentCompletions, upstream[name].getArgumentCompletions);
		}
	});

	it("forwards event subscriptions unchanged and never touches tools", () => {
		const lean = activateInto(leanActivate);
		const upstream = activateInto(upstreamActivate);
		assert.deepEqual(
			lean.handlers.map(([event]) => event),
			upstream.handlers.map(([event]) => event),
		);
		assert.ok(lean.handlers.length > 0);
		assert.deepEqual(lean.tools, []);
		assert.deepEqual(lean.activeSet, []);
	});
});

describe("upstream delegation", () => {
	it("lean /context runs the real upstream logic", async () => {
		// Outside TUI mode upstream refuses with a warning naming the typed view;
		// that string is only producible by upstream code.
		const lean = asMap(activateInto(leanActivate));
		const notices = [];
		const ctx = {
			mode: "print",
			hasUI: true,
			ui: { notify: (message) => notices.push(String(message)) },
		};
		await lean.context.handler("", ctx);
		assert.match(notices.join("\n"), /\/context usage is available in TUI mode only\./);
	});

	it("reports invalid args with the upstream usage error", async () => {
		const lean = asMap(activateInto(leanActivate));
		const notices = [];
		const ctx = {
			mode: "print",
			hasUI: true,
			ui: { notify: (message) => notices.push(String(message)) },
		};
		await lean.context.handler("bogus", ctx);
		assert.match(notices.join("\n"), /Usage: \/context \[usage\|injections\|config\]/);
	});
});
