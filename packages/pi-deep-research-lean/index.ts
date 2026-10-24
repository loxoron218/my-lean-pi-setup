// pi-deep-research-lean — one-tool facade over pi-deep-research.
//
// Upstream 0.4.1 registers three tools (web_search, web_extract,
// research_checkpoint) with long always-on descriptions and prose-heavy
// schemas. This wrapper registers a single `research` tool and routes
// op search|extract|checkpoint to the upstream tools, whose full behavior
// (provider chain, extraction, checkpoint gate, validation) is untouched.
// Full upstream descriptions and schemas stay local and are only disclosed
// through op help. Nothing here changes the active tool set at runtime.
import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionToolContext,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import upstreamActivate from "pi-deep-research/extension.ts";

const UPSTREAM_VERSION = "0.4.1";
const SEARCH_TOOL = "web_search";
const EXTRACT_TOOL = "web_extract";
const CHECKPOINT_TOOL = "research_checkpoint";

const OPS = ["search", "extract", "checkpoint", "help"] as const;
type Op = (typeof OPS)[number];

type AnyTool = ToolDefinition<any, any, any>;

// Rare options live behind op help as a JSON string so the always-on schema
// stays small. Common fields stay typed. Names, types, and constraints are
// unchanged from upstream; only prose `description` fields are dropped.
const SEARCH_OPTION_KEYS = ["search_depth", "include_domains", "exclude_domains"] as const;
const CHECKPOINT_OPTION_KEYS = ["contradictions", "gaps"] as const;

const SUB_QUESTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["question", "answered", "confidence", "source_count", "best_source_tier"],
  properties: {
    question: { type: "string" },
    answered: { type: "boolean" },
    confidence: { type: "number" },
    source_count: { type: "number" },
    best_source_tier: { type: "number" },
  },
};

const FACADE_PARAMETERS = {
  type: "object",
  additionalProperties: false,
  required: ["op"],
  properties: {
    op: { type: "string", enum: [...OPS] },
    query: { type: "string" },
    queries: { type: "array", maxItems: 5, items: { type: "string" } },
    max_results: { type: "number", default: 5, maximum: 10 },
    url: { type: "string" },
    depth: { type: "string" },
    round: { type: "number" },
    sub_questions: { type: "array", items: SUB_QUESTION_SCHEMA },
    total_sources: { type: "number" },
    options: { type: "string" },
  },
};

const FACADE_DESCRIPTION =
  "Research the web: find sources (op search), read page content (op extract), or submit progress for a CONTINUE/PROCEED verdict (op checkpoint). Obey the verdict before reporting. Use op help for full schemas.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Runs before schema validation. Fills in an omitted op only when the payload
// names exactly one of the three upstream tools; anything else is left for
// validation to report.
function prepareResearchArguments(args: unknown): unknown {
  if (!isRecord(args)) return args;
  const { op } = args;
  if (typeof op === "string" && (OPS as readonly string[]).includes(op)) return args;
  if (op !== undefined) return args;
  const hints = [
    args.query !== undefined || args.queries !== undefined ? ("search" satisfies Op) : undefined,
    typeof args.url === "string" ? ("extract" satisfies Op) : undefined,
    args.sub_questions !== undefined ||
    args.round !== undefined ||
    args.depth !== undefined ||
    args.total_sources !== undefined
      ? ("checkpoint" satisfies Op)
      : undefined,
  ].filter((hint): hint is Op => hint !== undefined);
  if (hints.length === 1) return { ...args, op: hints[0] };
  return args;
}

// Parses the JSON-string `options` field into the rare upstream parameters for
// the given op. Unknown keys fail loudly instead of being silently dropped.
function parseResearchOptions(op: Op, params: Record<string, unknown>): Record<string, unknown> {
  const raw = params.options;
  if (raw === undefined) return {};
  if (typeof raw !== "string") {
    throw new Error(`research: "options" must be a JSON object string, got ${JSON.stringify(raw)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`research: "options" must be a JSON object string, got ${JSON.stringify(raw)}`);
  }
  if (!isRecord(parsed)) {
    throw new Error(`research: "options" must be a JSON object string, got ${JSON.stringify(raw)}`);
  }
  const allowed: readonly string[] =
    op === "search" ? SEARCH_OPTION_KEYS : op === "checkpoint" ? CHECKPOINT_OPTION_KEYS : [];
  if (op !== "search" && op !== "checkpoint") {
    throw new Error(`research: "options" only applies to op "search" or "checkpoint"`);
  }
  for (const key of Object.keys(parsed)) {
    if (!allowed.includes(key)) {
      throw new Error(
        `research: unknown option ${JSON.stringify(key)} for op ${JSON.stringify(op)} (expected: ${allowed.join(", ")})`,
      );
    }
  }
  return parsed;
}

function dropUndefined(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined));
}

// Pure parameter routing, exported for tests: picks exactly the payload keys
// the upstream tool for op reads, so a mismatched payload fails with the
// upstream field error instead of silently crossing tools.
export function buildResearchParams(
  op: Op,
  params: Record<string, unknown>,
): { toolName: string; toolParams: Record<string, unknown> } {
  if (op === "search") {
    const extra = parseResearchOptions(op, params);
    return {
      toolName: SEARCH_TOOL,
      toolParams: dropUndefined({
        query: params.query,
        queries: params.queries,
        max_results: params.max_results,
        search_depth: extra.search_depth,
        include_domains: extra.include_domains,
        exclude_domains: extra.exclude_domains,
      }),
    };
  }
  if (op === "extract") {
    if (params.options !== undefined) parseResearchOptions(op, params);
    return { toolName: EXTRACT_TOOL, toolParams: dropUndefined({ url: params.url }) };
  }
  const extra = parseResearchOptions(op, params);
  return {
    toolName: CHECKPOINT_TOOL,
    toolParams: dropUndefined({
      depth: params.depth,
      round: params.round,
      sub_questions: params.sub_questions,
      total_sources: params.total_sources,
      contradictions: extra.contradictions,
      gaps: extra.gaps,
    }),
  };
}

// The upstream activate function registers its three tools on the given pi
// object. Swallow the registrations (capture, don't publish) and keep the
// active tool set untouched; everything else passes through to the real pi.
function capturePi(pi: ExtensionAPI, tools: Map<string, AnyTool>): ExtensionAPI {
  return new Proxy(pi, {
    get(target, prop, receiver) {
      if (prop === "registerTool") {
        return (tool: AnyTool) => {
          tools.set(tool.name, tool);
        };
      }
      if (prop === "setActiveTools") return () => undefined;
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function helpResult(tools: Map<string, AnyTool>): AgentToolResult<unknown> {
  const lines = [
    `research routes to upstream ${SEARCH_TOOL}, ${EXTRACT_TOOL}, and ${CHECKPOINT_TOOL} (${UPSTREAM_VERSION}):`,
  ];
  for (const [op, name] of [
    ["search", SEARCH_TOOL],
    ["extract", EXTRACT_TOOL],
    ["checkpoint", CHECKPOINT_TOOL],
  ] as const) {
    const tool = tools.get(name);
    lines.push("", `${op}: ${tool?.description ?? "(unavailable)"}`);
    lines.push(`Parameters must match this schema: ${JSON.stringify(tool?.parameters ?? {})}`);
  }
  lines.push(
    "",
    `Rare options go in "options" as a JSON object string: search accepts ${SEARCH_OPTION_KEYS.join(", ")}; checkpoint accepts ${CHECKPOINT_OPTION_KEYS.join(", ")}.`,
  );
  return {
    content: [{ type: "text", text: lines.join("\n") }],
    details: { source: "research", op: "help" },
  };
}

async function executeResearch(
  tools: Map<string, AnyTool>,
  toolCallId: string,
  params: Record<string, unknown>,
  signal: AbortSignal | undefined,
  onUpdate: ((update: unknown) => void) | undefined,
  ctx: ExtensionToolContext,
): Promise<AgentToolResult<unknown>> {
  const op = params.op as Op | undefined;
  if (op === "help") return helpResult(tools);
  if (op !== "search" && op !== "extract" && op !== "checkpoint") {
    throw new Error(
      `research: unknown op ${JSON.stringify(op)} (expected "search", "extract", "checkpoint", or "help")`,
    );
  }
  const { toolName, toolParams } = buildResearchParams(op, params);
  const tool = tools.get(toolName);
  if (!tool) {
    throw new Error(`research: upstream tool ${toolName} was not captured`);
  }
  return tool.execute(toolCallId, toolParams, signal, onUpdate as never, ctx);
}

async function activate(pi: ExtensionAPI) {
  const tools = new Map<string, AnyTool>();
  await (upstreamActivate as (pi: ExtensionAPI) => unknown)(capturePi(pi, tools));
  if (!tools.get(SEARCH_TOOL) || !tools.get(EXTRACT_TOOL) || !tools.get(CHECKPOINT_TOOL)) {
    throw new Error(`research: upstream tools missing (found: ${[...tools.keys()].join(", ") || "none"})`);
  }
  const facade: AnyTool = {
    name: "research",
    label: "Research",
    description: FACADE_DESCRIPTION,
    parameters: FACADE_PARAMETERS,
    prepareArguments: prepareResearchArguments,
    execute: (toolCallId, params, signal, onUpdate, ctx) =>
      executeResearch(
        tools,
        toolCallId,
        params as Record<string, unknown>,
        signal,
        onUpdate as ((update: unknown) => void) | undefined,
        ctx,
      ),
  };
  pi.registerTool(facade);
}

export default activate;
export { UPSTREAM_VERSION };
