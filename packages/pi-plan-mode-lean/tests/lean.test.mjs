import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { default: activateExtension, withHelperToolsActive, translatePlanToolCallEvent } =
  await jiti.import("../index.ts");

const QUESTION_TOOL = "plan_mode_question";
const COMPLETE_TOOL = "plan_mode_complete";

function stubPi(activeTools = []) {
  const calls = { tools: [], commands: [], activeSet: [], handlers: [] };
  const noop = () => undefined;
  const pi = new Proxy(
    {},
    {
      get(_t, p) {
        if (p === "registerTool")
          return (tool) => {
            calls.tools.push(tool);
          };
        if (p === "registerCommand")
          return (name) => {
            calls.commands.push(name);
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
        if (p === "getAllTools") return () => [];
        if (p === "getActiveTools") return () => [...activeTools];
        if (p === "events") return { on: noop };
        if (p === "ui") return { notify: noop };
        if (p === "then") return undefined;
        return noop;
      },
    },
  );
  return { pi, calls };
}

function activate() {
  const { pi, calls } = stubPi();
  activateExtension(pi);
  assert.equal(calls.tools.length, 1);
  return { facade: calls.tools[0], calls };
}

const validQuestions = [
  {
    id: "scope",
    header: "Scope",
    question: "Which scope should the plan cover?",
    options: [
      { label: "Core only", description: "Smallest change that works." },
      { label: "Core plus tests", description: "Also updates the test suite." },
    ],
  },
];

describe("activation", () => {
  it("registers exactly one tool and hides the upstream tools", () => {
    const { facade, calls } = activate();
    assert.equal(facade.name, "plan");
    assert.deepEqual(
      calls.tools.map((t) => t.name),
      ["plan"],
    );
  });

  it("passes the /plan command through and never touches the active tool set", () => {
    const { calls } = activate();
    assert.ok(calls.commands.includes("plan"));
    assert.deepEqual(calls.activeSet, []);
  });

  it("keeps the call contract in the description", () => {
    const { facade } = activate();
    assert.match(facade.description, /Only while the Plan contract says \/plan mode is active/);
    assert.match(facade.description, /op help/);
  });
});

describe("prepareArguments", () => {
  it("infers op from an unambiguous payload", () => {
    const { facade } = activate();
    assert.equal(facade.prepareArguments({ questions: validQuestions }).op, "question");
    assert.equal(facade.prepareArguments({ plan: "# Plan" }).op, "complete");
  });

  it("leaves ambiguous or invalid payloads for schema validation", () => {
    const { facade } = activate();
    assert.equal(facade.prepareArguments({}).op, undefined);
    assert.equal(
      facade.prepareArguments({ questions: validQuestions, plan: "# Plan" }).op,
      undefined,
    );
    assert.equal(facade.prepareArguments({ op: "nope" }).op, "nope");
    assert.equal(facade.prepareArguments({ op: "question" }).op, "question");
  });
});

describe("execute", () => {
  const ctx = { hasUI: false };

  it("routes op question to the upstream question tool", async () => {
    const { facade } = activate();
    const result = await facade.execute("1", { op: "question", questions: validQuestions }, undefined, undefined, ctx);
    // Plan mode was never entered, so the upstream tool reports inactive —
    // proving the call reached plan_mode_question (not plan_mode_complete).
    assert.equal(result.details.reason, "plan_mode_inactive");
  });

  it("routes op complete to the upstream complete tool", async () => {
    const { facade } = activate();
    await assert.rejects(
      facade.execute("1", { op: "complete", plan: "# Plan" }, undefined, undefined, ctx),
      /only available while Plan mode is active/,
    );
  });

  it("rejects a mismatched payload with the upstream field error", async () => {
    const { facade } = activate();
    const result = await facade.execute("1", { op: "question" }, undefined, undefined, ctx);
    // Routed to the question tool, but Plan mode is off so the gate fires first.
    assert.equal(result.details.reason, "plan_mode_inactive");
  });

  it("rejects an unknown op with the valid op list", async () => {
    const { facade } = activate();
    await assert.rejects(facade.execute("1", { op: "nope" }, undefined, undefined, ctx), /"question", "complete", or "help"/);
    await assert.rejects(facade.execute("1", {}, undefined, undefined, ctx), /unknown op/);
  });

  it("op help discloses both full upstream descriptions and schemas", async () => {
    const { facade } = activate();
    const result = await facade.execute("1", { op: "help" }, undefined, undefined, ctx);
    const text = result.content.map((b) => b.text).join("\n");
    assert.match(text, new RegExp(QUESTION_TOOL));
    assert.match(text, new RegExp(COMPLETE_TOOL));
    // Full upstream text, not the trimmed facade copy.
    assert.match(text, /Tool visibility alone does not activate Plan mode/);
    // Full upstream schemas, prose descriptions included.
    assert.match(text, /Stable identifier for mapping answers/);
    assert.match(text, /The complete decision-ready implementation plan in Markdown/);
    assert.match(text, /"maxItems":3/);
    assert.match(text, /"maxLength":50000/);
  });
});

describe("schema stays lean", () => {
  it("carries no description prose but keeps every constraint", () => {
    const { facade } = activate();
    const params = facade.parameters;
    // The payload field *named* "description" stays; prose annotations go.
    const proseAt = [];
    const walk = (node, path) => {
      if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
      if (node && typeof node === "object") {
        for (const [key, value] of Object.entries(node)) {
          if (key === "description" && typeof value === "string") proseAt.push(path);
          else walk(value, `${path}.${key}`);
        }
      }
    };
    walk(params, "$");
    assert.deepEqual(proseAt, []);
    const props = params.properties;
    assert.deepEqual(props.op.enum, ["question", "complete", "help"]);
    assert.equal(props.questions.minItems, 1);
    assert.equal(props.questions.maxItems, 3);
    assert.equal(props.questions.items.properties.options.minItems, 2);
    assert.equal(props.questions.items.properties.options.maxItems, 4);
    assert.deepEqual(props.questions.items.required, ["id", "header", "question", "options"]);
    assert.equal(props.plan.minLength, 1);
    assert.equal(props.plan.maxLength, 50000);
    assert.deepEqual(params.required, ["op"]);
  });

  it("costs well under half the upstream startup tokens", async () => {
    const { facade } = activate();
    const upstream = await jiti.import("@narumitw/pi-plan-mode/dist/index.ts");
    const { pi, calls } = stubPi();
    upstream.default(pi);
    assert.deepEqual(
      calls.tools.map((t) => t.name).sort(),
      [COMPLETE_TOOL, QUESTION_TOOL],
    );
    const toolSize = (tool) =>
      tool.name.length + tool.description.length + JSON.stringify(tool.parameters).length;
    const upstreamSize = calls.tools.reduce((n, tool) => n + toolSize(tool), 0);
    const facadeSize = toolSize(facade);
    assert.ok(upstreamSize > 1500, `unexpected upstream size: ${upstreamSize}`);
    assert.ok(
      facadeSize < upstreamSize * 0.7,
      `facade ${facadeSize} chars vs upstream ${upstreamSize} chars`,
    );
  });
});

describe("upstream availability gates", () => {
  it("reports both helper names as active without registering them", () => {
    assert.deepEqual(withHelperToolsActive(["read"]), ["read", QUESTION_TOOL, COMPLETE_TOOL]);
    assert.deepEqual(withHelperToolsActive(["read", QUESTION_TOOL]), ["read", QUESTION_TOOL, COMPLETE_TOOL]);
    assert.deepEqual(withHelperToolsActive([]), [QUESTION_TOOL, COMPLETE_TOOL]);
  });

  it("presents plan calls to upstream under the routed helper name", () => {
    const question = { toolName: "plan", input: { op: "question" } };
    assert.equal(translatePlanToolCallEvent(question).toolName, QUESTION_TOOL);
    const complete = { toolName: "plan", input: { op: "complete", plan: "# P" } };
    assert.equal(translatePlanToolCallEvent(complete).toolName, COMPLETE_TOOL);
    const missingOp = { toolName: "plan", input: {} };
    assert.equal(translatePlanToolCallEvent(missingOp).toolName, COMPLETE_TOOL);
    // The shared event object is never mutated, and anything else passes through.
    assert.equal(question.toolName, "plan");
    const other = { toolName: "read", input: {} };
    assert.equal(translatePlanToolCallEvent(other), other);
    assert.equal(translatePlanToolCallEvent(null), null);
  });

  it("gives plan calls the exact helper verdicts in the upstream voter", async () => {
    const { pi, calls } = stubPi(["read"]);
    activateExtension(pi);
    const voter = calls.handlers.find(([event]) => event === "tool_call")[1];
    // Plan mode idle: a plan question call is blocked exactly like a helper call.
    const idle = await voter({ toolName: "plan", input: { op: "question" } }, {});
    assert.match(idle.reason, new RegExp(`${QUESTION_TOOL} is only available while Plan mode is active`));
    // While idle upstream waves every non-helper call through untouched.
    assert.equal(await voter({ toolName: "planx", input: {} }, {}), undefined);
    assert.equal(await voter({ toolName: "read", input: {} }, {}), undefined);
  });
});

describe("renderResult", () => {
  it("delegates to the upstream completion Markdown renderer", () => {
    const { facade } = activate();
    const rendered = facade.renderResult(
      {
        content: [{ type: "text", text: "**Proposed Plan**\n\n# Plan" }],
        details: { version: 1, source: COMPLETE_TOOL, plan: "# Plan" },
      },
      {},
      {},
      {},
    );
    assert.ok(rendered && typeof rendered === "object");
  });
});
