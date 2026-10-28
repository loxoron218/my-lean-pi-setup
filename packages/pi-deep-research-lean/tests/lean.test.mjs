import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { default: activateExtension, buildResearchParams, buildResearchCommand, UPSTREAM_VERSION } =
  await jiti.import("../index.ts");

const SEARCH_TOOL = "web_search";
const EXTRACT_TOOL = "web_extract";
const CHECKPOINT_TOOL = "research_checkpoint";

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

async function activate() {
  const { pi, calls } = stubPi();
  await activateExtension(pi);
  assert.equal(calls.tools.length, 1);
  return { facade: calls.tools[0], calls };
}

const answeredQuestions = [
  {
    question: "Which providers back the search stage?",
    answered: true,
    confidence: 0.9,
    source_count: 3,
    best_source_tier: 1,
  },
  {
    question: "How is progress gated?",
    answered: true,
    confidence: 0.85,
    source_count: 2,
    best_source_tier: 1,
  },
];

describe("activation", () => {
  it("registers exactly one tool, inactive until /research", async () => {
    const { facade, calls } = await activate();
    assert.equal(facade.name, "research");
    assert.equal(facade.defaultActive, false);
    assert.deepEqual(
      calls.tools.map((t) => t.name),
      ["research"],
    );
  });

  it("pins the upstream version it was written against", () => {
    assert.equal(UPSTREAM_VERSION, "0.4.1");
  });

  it("never touches the active tool set", async () => {
    const { calls } = await activate();
    assert.deepEqual(calls.activeSet, []);
  });

  it("keeps the checkpoint gate in the description", async () => {
    const { facade } = await activate();
    assert.match(facade.description, /CONTINUE\/PROCEED verdict/);
    assert.match(facade.description, /op help/);
  });
});

describe("on-demand visibility", () => {
  it("reveals the tool and rewrites /research to the skill command", async () => {
    const { pi, calls } = stubPi();
    await activateExtension(pi);
    const inputHandler = calls.handlers.find(([event]) => event === "input")[1];
    const result = await inputHandler({ text: "/research deep quantum batteries" }, {});
    assert.deepEqual(calls.activeSet, [["research"]]);
    assert.deepEqual(result, { action: "transform", text: "/skill:pi-deep-research deep quantum batteries" });
    // Already active: no redundant change, still rewrites.
    const { pi: pi2, calls: calls2 } = stubPi(["read", "research"]);
    await activateExtension(pi2);
    const result2 = await calls2.handlers.find(([event]) => event === "input")[1]({ text: "/research" }, {});
    assert.deepEqual(calls2.activeSet, []);
    assert.deepEqual(result2, { action: "transform", text: "/skill:pi-deep-research" });
  });

  it("buildResearchCommand only fires on /research invocations", () => {
    assert.equal(buildResearchCommand("/research deep quantum"), "/skill:pi-deep-research deep quantum");
    assert.equal(buildResearchCommand("/research"), "/skill:pi-deep-research");
    assert.equal(buildResearchCommand("/plan"), undefined);
    assert.equal(buildResearchCommand("research this topic for me"), undefined);
    assert.equal(buildResearchCommand("/researcher"), undefined);
  });

  it("leaves other input alone", async () => {
    const { pi, calls } = stubPi();
    await activateExtension(pi);
    const inputHandler = calls.handlers.find(([event]) => event === "input")[1];
    assert.equal(await inputHandler({ text: "/plan" }, {}), undefined);
    assert.equal(await inputHandler({ text: "research this topic for me" }, {}), undefined);
    assert.equal(await inputHandler({ text: "/researcher" }, {}), undefined);
    assert.deepEqual(calls.activeSet, []);
  });
});

describe("prepareArguments", () => {
  it("infers op from an unambiguous payload", async () => {
    const { facade } = await activate();
    assert.equal(facade.prepareArguments({ query: "pi extensions" }).op, "search");
    assert.equal(facade.prepareArguments({ queries: ["a", "b"] }).op, "search");
    assert.equal(facade.prepareArguments({ url: "https://example.com" }).op, "extract");
    assert.equal(
      facade.prepareArguments({ depth: "quick", round: 1, sub_questions: [], total_sources: 0 }).op,
      "checkpoint",
    );
  });

  it("leaves ambiguous or invalid payloads for schema validation", async () => {
    const { facade } = await activate();
    assert.equal(facade.prepareArguments({}).op, undefined);
    assert.equal(facade.prepareArguments({ query: "a", url: "https://example.com" }).op, undefined);
    assert.equal(facade.prepareArguments({ op: "nope" }).op, "nope");
    assert.equal(facade.prepareArguments({ op: "search" }).op, "search");
  });
});

describe("buildResearchParams", () => {
  it("routes each op to its upstream tool with only the keys that tool reads", () => {
    assert.deepEqual(buildResearchParams("search", { op: "search", query: "q", url: "https://x" }), {
      toolName: SEARCH_TOOL,
      toolParams: { query: "q" },
    });
    assert.deepEqual(buildResearchParams("extract", { op: "extract", url: "https://x", query: "q" }), {
      toolName: EXTRACT_TOOL,
      toolParams: { url: "https://x" },
    });
    const checkpoint = buildResearchParams("checkpoint", {
      op: "checkpoint",
      depth: "quick",
      round: 1,
      sub_questions: [],
      total_sources: 0,
      query: "q",
    });
    assert.equal(checkpoint.toolName, CHECKPOINT_TOOL);
    assert.deepEqual(Object.keys(checkpoint.toolParams).sort(), [
      "depth",
      "round",
      "sub_questions",
      "total_sources",
    ]);
  });

  it("merges a valid options object into the rare upstream fields", () => {
    const search = buildResearchParams("search", {
      query: "q",
      options: JSON.stringify({ search_depth: "advanced", include_domains: ["a.example"] }),
    });
    assert.equal(search.toolParams.search_depth, "advanced");
    assert.deepEqual(search.toolParams.include_domains, ["a.example"]);
    const checkpoint = buildResearchParams("checkpoint", {
      depth: "quick",
      round: 1,
      sub_questions: [],
      total_sources: 0,
      options: JSON.stringify({ gaps: ["need primary source"] }),
    });
    assert.deepEqual(checkpoint.toolParams.gaps, ["need primary source"]);
  });

  it("rejects malformed, non-object, unknown, or misapplied options", () => {
    assert.throws(() => buildResearchParams("search", { query: "q", options: "{nope" }), /JSON object string/);
    assert.throws(() => buildResearchParams("search", { query: "q", options: "[1]" }), /JSON object string/);
    assert.throws(
      () => buildResearchParams("search", { query: "q", options: JSON.stringify({ gaps: [] }) }),
      /unknown option "gaps" for op "search"/,
    );
    assert.throws(
      () => buildResearchParams("extract", { url: "https://x", options: JSON.stringify({}) }),
      /only applies to op "search" or "checkpoint"/,
    );
  });
});

describe("execute", () => {
  const ctx = { hasUI: false };

  it("routes op checkpoint to the local upstream gate (no network)", async () => {
    const { facade } = await activate();
    const result = await facade.execute(
      "1",
      { op: "checkpoint", depth: "standard", round: 6, sub_questions: answeredQuestions, total_sources: 5 },
      undefined,
      undefined,
      ctx,
    );
    const text = result.content.map((b) => b.text).join("\n");
    // Standard gate (min 5 sources, 75%) is satisfied: 6 rounds, 5 sources.
    assert.match(text, /PROCEED/);
  });

  it("rejects a mismatched payload with the upstream field error", async () => {
    const { facade } = await activate();
    // Routed to research_checkpoint, which reads sub_questions.length itself —
    // there is no execute-time schema validation upstream, so the native
    // TypeError proves the call crossed into the checkpoint tool.
    await assert.rejects(
      facade.execute("1", { op: "checkpoint", depth: "quick", round: 1, total_sources: 0 }, undefined, undefined, ctx),
      /reading 'length'/,
    );
  });

  it("rejects an unknown op with the valid op list", async () => {
    const { facade } = await activate();
    await assert.rejects(
      facade.execute("1", { op: "nope" }, undefined, undefined, ctx),
      /"search", "extract", "checkpoint", or "help"/,
    );
    await assert.rejects(facade.execute("1", {}, undefined, undefined, ctx), /unknown op/);
  });

  it("op help discloses all three full upstream descriptions and schemas", async () => {
    const { facade } = await activate();
    const result = await facade.execute("1", { op: "help" }, undefined, undefined, ctx);
    const text = result.content.map((b) => b.text).join("\n");
    assert.match(text, new RegExp(SEARCH_TOOL));
    assert.match(text, new RegExp(EXTRACT_TOOL));
    assert.match(text, new RegExp(CHECKPOINT_TOOL));
    // Full upstream text, not the trimmed facade copy.
    assert.match(text, /Supports single query or batch queries/);
    assert.match(text, /Strips HTML, scripts, navigation/);
    assert.match(text, /MANDATORY after each search round/);
    // Full upstream schemas, prose descriptions included.
    assert.match(text, /Single search query/);
    assert.match(text, /URL of the web page to extract content from/);
    assert.match(text, /"maxItems":5/);
    assert.match(text, /"maximum":10/);
  });
});

describe("schema stays lean", () => {
  it("carries no description prose but keeps every constraint", async () => {
    const { facade } = await activate();
    const params = facade.parameters;
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
    assert.deepEqual(props.op.enum, ["search", "extract", "checkpoint", "help"]);
    assert.equal(props.queries.maxItems, 5);
    assert.equal(props.max_results.default, 5);
    assert.equal(props.max_results.maximum, 10);
    assert.deepEqual(props.sub_questions.items.required, [
      "question",
      "answered",
      "confidence",
      "source_count",
      "best_source_tier",
    ]);
    assert.deepEqual(params.required, ["op"]);
  });

  it("costs well under half the upstream startup tokens", async () => {
    const { facade } = await activate();
    const upstream = await jiti.import("pi-deep-research/extension.ts");
    const { pi, calls } = stubPi();
    await upstream.default(pi);
    assert.deepEqual(
      calls.tools.map((t) => t.name).sort(),
      [CHECKPOINT_TOOL, EXTRACT_TOOL, SEARCH_TOOL],
    );
    const toolSize = (tool) =>
      tool.name.length + tool.description.length + JSON.stringify(tool.parameters).length;
    const upstreamSize = calls.tools.reduce((n, tool) => n + toolSize(tool), 0);
    const facadeSize = toolSize(facade);
    assert.ok(upstreamSize > 2000, `unexpected upstream size: ${upstreamSize}`);
    assert.ok(
      facadeSize < upstreamSize * 0.5,
      `facade ${facadeSize} chars vs upstream ${upstreamSize} chars`,
    );
  });
});
