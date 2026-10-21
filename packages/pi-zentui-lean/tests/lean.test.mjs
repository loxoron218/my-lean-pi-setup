import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { default: leanActivate, LEAN_DESCRIPTIONS } = await jiti.import("../index.ts");
const { default: upstreamActivate } = await jiti.import(
  "pi-zentui/extensions/zentui/index.ts",
);

// Pinned upstream command description (pi-zentui@0.32.0). If upstream rewords
// it, this fails on purpose: update the trim mapping and MAINTENANCE.md.
const EXPECTED_UPSTREAM_DESCRIPTIONS = {
  zentui: "Configure Zentui",
};

const tokens = (chars) => Math.ceil(chars / 4);

function stubPi() {
  const calls = { commands: [], tools: [], activeSet: [], handlers: [] };
  const noop = () => undefined;
  const events = {
    on: (event, handler) => {
      calls.handlers.push(["events", event, handler]);
      return noop;
    },
  };
  const pi = new Proxy(
    { events },
    {
      get(t, p) {
        if (p === "events") return events;
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
      ["zentui"],
    );
  });

  it("pins the upstream descriptions it trims", () => {
    const upstream = activateInto(upstreamActivate);
    assert.deepEqual(
      Object.fromEntries(
        upstream.commands.map(([name, options]) => [name, options.description]),
      ),
      EXPECTED_UPSTREAM_DESCRIPTIONS,
    );
  });

  it("swaps in shorter lean descriptions (16 chars/4 tok -> 6 chars/2 tok)", () => {
    const lean = activateInto(leanActivate);
    assert.deepEqual(
      Object.fromEntries(
        lean.commands.map(([name, options]) => [name, options.description]),
      ),
      LEAN_DESCRIPTIONS,
    );
    const chars = (map) => Object.values(map).join("").length;
    const upstreamChars = chars(EXPECTED_UPSTREAM_DESCRIPTIONS);
    const leanChars = chars(LEAN_DESCRIPTIONS);
    assert.equal(upstreamChars, 16);
    assert.equal(leanChars, 6);
    assert.ok(leanChars < upstreamChars);
    assert.deepEqual([tokens(upstreamChars), tokens(leanChars)], [4, 2]);
  });

  it("keeps the upstream handler and completions code untouched", () => {
    const lean = asMap(activateInto(leanActivate));
    const upstream = asMap(activateInto(upstreamActivate));
    for (const name of Object.keys(upstream)) {
      assert.equal(typeof lean[name].handler, "function");
      assert.equal(lean[name].handler.toString(), upstream[name].handler.toString());
      assert.equal(
        lean[name].getArgumentCompletions?.toString(),
        upstream[name].getArgumentCompletions?.toString(),
      );
    }
  });

  it("forwards event subscriptions unchanged and never touches tools", () => {
    const lean = activateInto(leanActivate);
    const upstream = activateInto(upstreamActivate);
    const eventNames = (calls) =>
      calls.handlers.map(([event, second]) =>
        event === "events" ? `events:${second}` : event,
      );
    assert.deepEqual(eventNames(lean), eventNames(upstream));
    assert.ok(lean.handlers.length > 0);
    assert.deepEqual(lean.tools, []);
    assert.deepEqual(lean.activeSet, []);
  });
});

describe("upstream delegation", () => {
  it("lean /zentui runs the real upstream handler", async () => {
    const lean = asMap(activateInto(leanActivate));
    const notices = [];
    const ctx = {
      hasUI: true,
      ui: { notify: (message) => notices.push(String(message)) },
    };
    // Unknown preset falls through to the usage notice; this exact string
    // only comes from upstream code.
    await lean.zentui.handler("preset bogus", ctx);
    assert.match(
      notices.join("\n"),
      /Usage: \/zentui \[editor\|messages\|statusline\|viewport-indicators\]/,
    );
  });
});
