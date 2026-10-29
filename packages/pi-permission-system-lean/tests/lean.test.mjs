import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { default: leanActivate, LEAN_DESCRIPTIONS } = await jiti.import("../index.ts");
// The exports map only exposes "." (the service surface), so tests reach the
// entry point the same way index.ts does: by file path.
const { default: upstreamActivate } = await jiti.import(
  "../node_modules/@gotgenes/pi-permission-system/src/index.ts",
);

// Pinned upstream command description (@gotgenes/pi-permission-system@42.0.0).
// If upstream rewords it, this fails on purpose: update the trim mapping and
// MAINTENANCE.md.
const EXPECTED_UPSTREAM_DESCRIPTIONS = {
  "permission-system": "Configure pi-permission-system logging and yolo-mode behavior",
};

const tokens = (chars) => Math.ceil(chars / 4);

function stubPi() {
  const calls = { commands: [], tools: [], activeSet: [], handlers: [], eventsOn: [], emitted: [] };
  const noop = () => undefined;
  // Upstream subscribes to @gotgenes/pi-subagents' child lifecycle on
  // pi.events, so the stub models it like a real Pi would.
  const events = {
    on: (event, handler) => {
      calls.eventsOn.push([event, handler]);
      return noop;
    },
    emit: (event, value) => {
      calls.emitted.push([event, value]);
    },
  };
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
        if (p === "events") return events;
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
      ["permission-system"],
    );
  });

  it("pins the upstream description it trims", () => {
    const upstream = activateInto(upstreamActivate);
    assert.deepEqual(
      Object.fromEntries(
        upstream.commands.map(([name, options]) => [name, options.description]),
      ),
      EXPECTED_UPSTREAM_DESCRIPTIONS,
    );
  });

  it("swaps in a shorter lean description (61 chars/16 tok -> 39 chars/10 tok)", () => {
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
    assert.equal(upstreamChars, 61);
    assert.equal(leanChars, 39);
    assert.ok(leanChars < upstreamChars);
    assert.deepEqual([tokens(upstreamChars), tokens(leanChars)], [16, 10]);
  });

  it("keeps the upstream handler code untouched", () => {
    const lean = asMap(activateInto(leanActivate));
    const upstream = asMap(activateInto(upstreamActivate));
    for (const name of Object.keys(upstream)) {
      assert.equal(typeof lean[name].handler, "function");
      assert.equal(lean[name].handler.toString(), upstream[name].handler.toString());
    }
  });

  it("forwards event subscriptions unchanged and never touches tools at activation", () => {
    const lean = activateInto(leanActivate);
    const upstream = activateInto(upstreamActivate);
    assert.deepEqual(
      lean.handlers.map(([event]) => event),
      upstream.handlers.map(([event]) => event),
    );
    assert.deepEqual(
      lean.handlers.map(([event]) => event),
      [
        "session_start",
        "resources_discover",
        "session_shutdown",
        "before_agent_start",
        "input",
        "tool_call",
      ],
    );
    // Upstream 41.x observes @gotgenes/pi-subagents' child lifecycle on
    // pi.events (session-created/bound/disposed). The facade passes the
    // events object through, so both sides subscribe identically and neither
    // emits during activation.
    assert.deepEqual(
      lean.eventsOn.map(([event]) => event),
      upstream.eventsOn.map(([event]) => event),
    );
    assert.deepEqual(
      upstream.eventsOn.map(([event]) => event),
      [
        "subagents:child:session-created",
        "subagents:child:bound",
        "subagents:child:disposed",
      ],
    );
    assert.deepEqual(lean.emitted, []);
    assert.deepEqual(upstream.emitted, []);
    // Upstream registers zero tools; per-turn tool hiding happens inside the
    // before_agent_start handler, not at activation, so activation itself
    // must not call setActiveTools. The facade must not "stabilize" that
    // away: hiding fully-denied tools is the feature.
    assert.deepEqual(lean.tools, []);
    assert.deepEqual(upstream.tools, []);
    assert.deepEqual(lean.activeSet, []);
    assert.deepEqual(upstream.activeSet, []);
  });
});

describe("upstream delegation", () => {
  it("lean /permission-system runs the real upstream arg validation", async () => {
    const lean = asMap(activateInto(leanActivate));
    const notices = [];
    const ctx = { ui: { notify: (message) => notices.push(String(message)) } };
    // An unknown argument never reaches the modal: upstream answers with its
    // usage text. This exact string only comes from upstream code.
    await lean["permission-system"].handler("bogus", ctx);
    assert.match(
      notices.join("\n"),
      /Usage: \/permission-system \[show\|path\|reset\|help\]/,
    );
  });

  it("lean /permission-system runs the real upstream no-TUI guard", async () => {
    const lean = asMap(activateInto(leanActivate));
    const notices = [];
    // No args and no TUI: upstream refuses before opening the modal.
    // Either the notify text or the lack of a throw proves the handler is
    // the original code (a lean reimplementation would not reproduce this).
    await lean["permission-system"].handler("", {
      hasUI: false,
      ui: { notify: (message) => notices.push(String(message)) },
    });
    assert.match(
      notices.join("\n"),
      /\/permission-system requires interactive TUI mode/,
    );
  });
});
