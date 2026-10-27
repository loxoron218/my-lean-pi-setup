import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { before, describe, it } from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { default: leanActivate, LEAN_DESCRIPTIONS } = await jiti.import("../index.ts");
const { default: upstreamActivate } = await jiti.import(
  "pi-workspace-history/.pi/extensions/workspace-history.ts",
);

// Pinned upstream command descriptions (pi-workspace-history@0.5.2). If upstream
// rewords one, this fails on purpose: update the trim mapping and MAINTENANCE.md.
const EXPECTED_UPSTREAM_DESCRIPTIONS = {
  undo: "Undo last agent turn with optional workspace restore",
  redo: "Redo previously undone navigation",
  checkpoint: "Save current workspace state as a manual time-machine checkpoint",
  diff: "Show the file changes made by the latest agent operation (/diff 2 for the one before)",
  "history-status":
    "Show whether workspace history is active, where it is stored, and recent problems",
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
    assert.deepEqual(lean.commands.map(([name]) => name).sort(), [
      "checkpoint",
      "diff",
      "history-status",
      "redo",
      "undo",
    ]);
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

  it("swaps in shorter lean descriptions (315 chars/79 tok -> 210 chars/53 tok)", () => {
    const lean = activateInto(leanActivate);
    assert.deepEqual(Object.fromEntries(
      lean.commands.map(([name, options]) => [name, options.description]),
    ), LEAN_DESCRIPTIONS);
    const chars = (map) => Object.values(map).join("").length;
    const upstreamChars = chars(EXPECTED_UPSTREAM_DESCRIPTIONS);
    const leanChars = chars(LEAN_DESCRIPTIONS);
    assert.equal(upstreamChars, 315);
    assert.equal(leanChars, 210);
    assert.ok(leanChars < upstreamChars);
    assert.deepEqual([tokens(upstreamChars), tokens(leanChars)], [79, 53]);
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
  let agentDir;
  let workDir;
  before(() => {
    delete process.env.PI_WORKSPACE_HISTORY_LOG;
    agentDir = mkdtempSync(path.join(tmpdir(), "wsh-lean-agent-"));
    workDir = mkdtempSync(path.join(tmpdir(), "wsh-lean-work-"));
    process.env.PI_CODING_AGENT_DIR = agentDir;
  });

  it("lean /undo runs the real upstream logic", async () => {
    const lean = asMap(activateInto(leanActivate));
    const notices = [];
    let waited = false;
    const ctx = {
      cwd: workDir,
      waitForIdle: async () => {
        waited = true;
      },
      ui: { notify: (message) => notices.push(String(message)) },
      sessionManager: { getSessionId: () => "test-session" },
    };
    await lean.undo.handler("", ctx);
    assert.equal(waited, true);
    // Exact upstream string, only producible by upstream code, in a directory
    // with no project marker and no settings (hermetic PI_CODING_AGENT_DIR).
    assert.match(
      notices.join("\n"),
      /Workspace history is disabled for this directory: no project marker found/,
    );
  });
});
