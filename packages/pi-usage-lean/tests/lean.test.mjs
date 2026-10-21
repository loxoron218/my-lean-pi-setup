import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { default: leanActivate, LEAN_DESCRIPTIONS } = await jiti.import("../index.ts");
const { default: upstreamActivate } = await jiti.import(
  "@narumitw/pi-usage/dist/index.ts",
);

// Pinned upstream command descriptions (@narumitw/pi-usage@0.67.0). If upstream
// rewords one, this fails on purpose: update the trim mapping and MAINTENANCE.md.
const EXPECTED_UPSTREAM_DESCRIPTIONS = {
  usage: "Show usage for the current runtime account",
  fast: "Toggle Codex Fast mode",
};

const tokens = (chars) => Math.ceil(chars / 4);

function stubPi() {
  const calls = { commands: [], tools: [], activeSet: [], handlers: [] };
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
      ["fast", "usage"],
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

  it("swaps in shorter lean descriptions (64 chars/16 tok -> 49 chars/13 tok)", () => {
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
    assert.equal(upstreamChars, 64);
    assert.equal(leanChars, 49);
    assert.ok(leanChars < upstreamChars);
    assert.deepEqual([tokens(upstreamChars), tokens(leanChars)], [16, 13]);
  });

  it("keeps the upstream handler code untouched", () => {
    const lean = asMap(activateInto(leanActivate));
    const upstream = asMap(activateInto(upstreamActivate));
    for (const name of Object.keys(upstream)) {
      assert.equal(typeof lean[name].handler, "function");
      assert.equal(lean[name].handler.toString(), upstream[name].handler.toString());
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
  it("lean /usage runs the real upstream arg validation", async () => {
    const lean = asMap(activateInto(leanActivate));
    const notices = [];
    const ctx = { ui: { notify: (message) => notices.push(String(message)) } };
    // Upstream rejects arguments before touching the menu; this exact string
    // only comes from upstream code.
    await lean.usage.handler("codex", ctx);
    assert.match(
      notices.join("\n"),
      /\/usage does not accept arguments/,
    );
  });

  it("lean /fast runs the real upstream arg validation", async () => {
    const lean = asMap(activateInto(leanActivate));
    // No TUI here (ctx.hasUI falsy), so upstream throws before toggling.
    // Either upstream error proves the handler is the original code.
    await assert.rejects(
      lean.fast.handler("on", { hasUI: false }),
      /\/fast does not accept arguments|requires TUI or RPC mode/,
    );
  });
});
