import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";

const require = createRequire(import.meta.url);
const jiti = createJiti(import.meta.url);
const { default: leanActivate, fullInstructions, UPSTREAM_VERSION } = await jiti.import("../index.ts");

// The upstream package.json `exports` map only exposes "." and "./plugin",
// so deep specifier imports fail with ERR_PACKAGE_PATH_NOT_EXPORTED. Resolve
// the package root through the exported entry (like index.ts does) and load
// the pi extension plus hook files by absolute path.
const upstreamRoot = path.dirname(
	path.dirname(path.dirname(require.resolve("@dietrichgebert/ponytail"))),
);
const { default: upstreamActivate } = await jiti.import(
	path.join(upstreamRoot, "pi-extension", "index.js"),
);
const { getPonytailInstructions } = require(
	path.join(upstreamRoot, "hooks", "ponytail-instructions.js"),
);

assert.equal(UPSTREAM_VERSION, "5.3.2");

const EXPECTED_COMMANDS = [
	"ponytail",
	"ponytail-review",
	"ponytail-audit",
	"ponytail-gain",
	"ponytail-debt",
	"ponytail-help",
].sort();

// Pinned upstream command descriptions (@dietrichgebert/ponytail@5.3.2). If
// upstream rewords one, this fails on purpose: update the lean numbers and
// MAINTENANCE.md. Total: 63 + 26 + 25 + 24 + 24 + 24 = 186 chars (47 tokens).
const EXPECTED_UPSTREAM_COMMAND_CHARS = 186;

// Pinned upstream skill-frontmatter description chars (all six skills). Lean
// ships no skills, so all of it disappears from startup context:
// 366 + 294 + 173 + 141 + 75 + 291 = 1340 chars (335 tokens).
const EXPECTED_UPSTREAM_SKILL_DESC_CHARS = 1340;

// Pinned full-mode prompt chars. Lean injects this text verbatim every turn,
// so any upstream rewording must update the README numbers on purpose.
const EXPECTED_FULL_CHARS = 2859;

const EXPECTED_UPSTREAM_EVENTS = [
	"input",
	"session_start",
	"session_tree",
	"session_switch",
	"session_branch",
	"agent_start",
	"agent_end",
	"before_agent_start",
].sort();

const tokens = (chars) => Math.ceil(chars / 4);

function skillDescriptionChars(skillDir) {
	const text = readFileSync(path.join(skillDir, "SKILL.md"), "utf8");
	const frontmatter = text.match(/^---\n([\s\S]*?)\n---/)[1];
	const block = frontmatter.match(/description: >\n((?:  .*\n)+)/)[1];
	return block
		.replace(/^  /gm, "")
		.replace(/\n/g, " ")
		.trim().length;
}

function stubPi() {
	const calls = { commands: [], tools: [], activeSet: [], events: [], entries: [], messages: [] };
	const noop = () => undefined;
	const pi = new Proxy(
		{},
		{
			get(_t, p) {
				if (p === "registerCommand") return (name, options) => calls.commands.push([name, options]);
				if (p === "registerTool") return (tool) => calls.tools.push(tool);
				if (p === "setActiveTools") return (names) => calls.activeSet.push(names);
				if (p === "getActiveTools") return () => [];
				if (p === "on") return (event, handler) => {
					calls.events.push([event, handler]);
					return noop;
				};
				if (p === "appendEntry") return (...args) => calls.entries.push(args);
				if (p === "sendUserMessage") return (...args) => calls.messages.push(args);
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

const asMap = (calls) => Object.fromEntries(calls.events);

describe("upstream surface pin", () => {
	it("registers exactly the six commands, no more, no fewer", () => {
		const calls = activateInto(upstreamActivate);
		assert.deepEqual(
			calls.commands.map(([name]) => name).sort(),
			EXPECTED_COMMANDS,
		);
	});

	it("registers zero tools and never touches the active tool set", () => {
		const calls = activateInto(upstreamActivate);
		assert.deepEqual(calls.tools, []);
		assert.deepEqual(calls.activeSet, []);
	});

	it("subscribes the known event set (mode switching lives here)", () => {
		const calls = activateInto(upstreamActivate);
		assert.deepEqual(
			calls.events.map(([event]) => event).sort(),
			EXPECTED_UPSTREAM_EVENTS,
		);
	});

	it("pins the upstream command description chars it trims away", () => {
		const calls = activateInto(upstreamActivate);
		const chars = calls.commands.map(([, options]) => options.description.length);
		assert.deepEqual(chars.sort((a, b) => a - b), [24, 24, 24, 25, 26, 63]);
		assert.equal(chars.reduce((sum, n) => sum + n, 0), EXPECTED_UPSTREAM_COMMAND_CHARS);
		assert.deepEqual(
			[tokens(EXPECTED_UPSTREAM_COMMAND_CHARS)],
			[47],
		);
	});

	it("pins the upstream skill description chars lean drops", () => {
		const skillsDir = path.join(upstreamRoot, "skills");
		const names = ["ponytail", "ponytail-audit", "ponytail-debt", "ponytail-gain", "ponytail-help", "ponytail-review"];
		const total = names.map((name) => skillDescriptionChars(path.join(skillsDir, name))).reduce((a, b) => a + b, 0);
		assert.equal(total, EXPECTED_UPSTREAM_SKILL_DESC_CHARS);
	});
});

describe("lean surface", () => {
	it("registers no commands and no tools", () => {
		const calls = activateInto(leanActivate);
		assert.deepEqual(calls.commands, []);
		assert.deepEqual(calls.tools, []);
		assert.deepEqual(calls.activeSet, []);
	});

	it("subscribes only to before_agent_start", () => {
		const calls = activateInto(leanActivate);
		assert.deepEqual(
			calls.events.map(([event]) => event),
			["before_agent_start"],
		);
	});

	it("never writes session entries or sends messages at activate", () => {
		const calls = activateInto(leanActivate);
		assert.deepEqual(calls.entries, []);
		assert.deepEqual(calls.messages, []);
	});
});

describe("verbatim full prompt", () => {
	const expected = getPonytailInstructions("full");

	it("pins the full-mode text lean injects", () => {
		assert.equal(expected.length, EXPECTED_FULL_CHARS);
		assert.match(expected, /^PONYTAIL MODE ACTIVE — level: full\n/);
		assert.equal(fullInstructions(), expected);
	});

	it("matches what upstream injects in its default state", async () => {
		const calls = activateInto(upstreamActivate);
		const handler = asMap(calls)["before_agent_start"];
		const event = { systemPrompt: "", systemPromptOptions: { sections: {} } };
		await handler(event, {});
		assert.equal(event.systemPromptOptions.sections.ponytail, expected);
	});

	it("sets sections.ponytail on structured events", async () => {
		const calls = activateInto(leanActivate);
		const handler = asMap(calls)["before_agent_start"];
		const event = { systemPrompt: "base", systemPromptOptions: { sections: { other: "x" } } };
		const result = await handler(event, {});
		assert.equal(result, undefined);
		assert.equal(event.systemPromptOptions.sections.ponytail, expected);
		assert.equal(event.systemPromptOptions.sections.other, "x");
	});

	it("appends to string prompts on legacy events", async () => {
		const calls = activateInto(leanActivate);
		const handler = asMap(calls)["before_agent_start"];
		assert.deepEqual(await handler({ systemPrompt: "base" }, {}), {
			systemPrompt: `base\n\n${expected}`,
		});
		assert.deepEqual(await handler({}, {}), { systemPrompt: expected });
	});

	it("appends one part on array prompts", async () => {
		const calls = activateInto(leanActivate);
		const handler = asMap(calls)["before_agent_start"];
		assert.deepEqual(await handler({ systemPrompt: ["a"] }, {}), {
			systemPrompt: ["a", expected],
		});
	});

	it("ignores mode configuration and stays on full", async () => {
		const previous = process.env.PONYTAIL_DEFAULT_MODE;
		process.env.PONYTAIL_DEFAULT_MODE = "ultra";
		try {
			const calls = activateInto(leanActivate);
			const handler = asMap(calls)["before_agent_start"];
			const event = { systemPrompt: "", systemPromptOptions: { sections: {} } };
			await handler(event, {});
			assert.equal(event.systemPromptOptions.sections.ponytail, expected);
			assert.match(event.systemPromptOptions.sections.ponytail, /level: full/);
		} finally {
			if (previous === undefined) delete process.env.PONYTAIL_DEFAULT_MODE;
			else process.env.PONYTAIL_DEFAULT_MODE = previous;
		}
	});
});

describe("stable prompt list", () => {
	it("emitting before_agent_start changes no tools, commands, or entries", async () => {
		const { pi, calls } = stubPi();
		leanActivate(pi);
		const handler = asMap(calls)["before_agent_start"];
		await handler({ systemPrompt: "", systemPromptOptions: { sections: {} } }, {});
		assert.deepEqual(calls.commands, []);
		assert.deepEqual(calls.tools, []);
		assert.deepEqual(calls.activeSet, []);
		assert.deepEqual(calls.entries, []);
		assert.deepEqual(calls.messages, []);
	});

	it("startup model text is zero tokens; per-turn prompt equals upstream full", () => {
		const lean = activateInto(leanActivate);
		const startupChars = lean.commands.map(([, o]) => o.description.length).reduce((a, b) => a + b, 0)
			+ lean.tools.length;
		assert.equal(startupChars, 0);
		assert.deepEqual(
			[tokens(EXPECTED_FULL_CHARS)],
			[715],
		);
		const removedChars = EXPECTED_UPSTREAM_COMMAND_CHARS + EXPECTED_UPSTREAM_SKILL_DESC_CHARS;
		assert.equal(removedChars, 1526);
		assert.deepEqual([tokens(removedChars)], [382]);
	});
});
