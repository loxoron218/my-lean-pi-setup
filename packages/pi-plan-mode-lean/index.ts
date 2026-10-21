// @ssk_dev/pi-plan-mode-lean — one-tool facade over @narumitw/pi-plan-mode.
//
// Upstream 0.59.4 registers two tools (plan_mode_question, plan_mode_complete) with
// 480 tokens of always-on description + schema prose. This wrapper registers a
// single `plan` tool (227 tokens) and routes op question|complete to the upstream
// tools, whose full behavior (validation, UI, /plan command, handlers) is untouched.
// Full upstream descriptions and schemas stay local and are only disclosed through
// op help. Nothing here changes the active tool set at runtime.
import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionToolContext,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import planModeActivate from "@narumitw/pi-plan-mode/dist/index.ts";

const UPSTREAM_VERSION = "0.59.4";
const QUESTION_TOOL = "plan_mode_question";
const COMPLETE_TOOL = "plan_mode_complete";

const OPS = ["question", "complete", "help"] as const;
type Op = (typeof OPS)[number];

type AnyTool = ToolDefinition<any, any, any>;

// Question/complete payload schemas: upstream shapes minus the prose
// `description` fields. Names, types, required, and min/max are unchanged.
const QUESTIONS_SCHEMA = {
  type: "array",
  minItems: 1,
  maxItems: 3,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["id", "header", "question", "options"],
    properties: {
      id: { type: "string" },
      header: { type: "string" },
      question: { type: "string" },
      options: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "description"],
          properties: {
            label: { type: "string" },
            description: { type: "string" },
          },
        },
      },
    },
  },
};

const FACADE_PARAMETERS = {
  type: "object",
  additionalProperties: false,
  required: ["op"],
  properties: {
    op: { type: "string", enum: [...OPS] },
    questions: QUESTIONS_SCHEMA,
    plan: { type: "string", minLength: 1, maxLength: 50000 },
  },
};

const FACADE_DESCRIPTION =
  "Plan-mode router: ask structured questions (op question) or submit the decision-ready plan (op complete). Only while the Plan contract says /plan mode is active. Never for ordinary planning or plan files. Use op help for full schemas.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Upstream gates Plan mode on its two helper names being in pi.getActiveTools()
// and carves them out of the tool_call policy voter by name. The facade answers
// both checks on the helpers' behalf: the names are reported active (the ops
// really are callable through `plan`) while the tools stay unregistered, so the
// model prompt and the launch menus never show them.
export function withHelperToolsActive(names: readonly string[]): string[] {
  return [...names, QUESTION_TOOL, COMPLETE_TOOL].filter((name, index, all) => all.indexOf(name) === index);
}

// Runs for every tool_call subscription upstream registers. A `plan` call is
// presented to upstream under the helper name its op routes to, giving it the
// exact required-helper semantics (allowed while active, blocked while idle).
// Anything else — including the event object itself — passes through untouched.
export function translatePlanToolCallEvent(event: unknown): unknown {
  if (!isRecord(event) || event.toolName !== "plan") return event;
  const input = isRecord(event.input) ? event.input : undefined;
  const helper = input?.op === "question" ? QUESTION_TOOL : COMPLETE_TOOL;
  return { ...event, toolName: helper };
}

// Runs before schema validation. Fills in an omitted op only when the payload
// names exactly one of the two upstream tools; anything else is left for
// validation to report.
function preparePlanArguments(args: unknown): unknown {
  if (!isRecord(args)) return args;
  const { op } = args;
  if (typeof op === "string" && (OPS as readonly string[]).includes(op)) return args;
  if (op !== undefined) return args;
  const hasPlan = typeof args.plan === "string";
  const hasQuestions = Array.isArray(args.questions);
  if (hasPlan && !hasQuestions) return { ...args, op: "complete" satisfies Op };
  if (hasQuestions && !hasPlan) return { ...args, op: "question" satisfies Op };
  return args;
}

// The upstream activate function registers both tools on the given pi object.
// Swallow the registrations (capture, don't publish) and keep the active tool
// set untouched; everything else (/plan command, handlers, model settings)
// passes through to the real pi.
function capturePi(pi: ExtensionAPI, tools: Map<string, AnyTool>): ExtensionAPI {
  return new Proxy(pi, {
    get(target, prop, receiver) {
      if (prop === "registerTool") {
        return (tool: AnyTool) => {
          tools.set(tool.name, tool);
        };
      }
      if (prop === "setActiveTools") return () => undefined;
      if (prop === "getActiveTools") {
        return () => withHelperToolsActive(target.getActiveTools());
      }
      if (prop === "on") {
        const subscribe = Reflect.get(target, prop, receiver);
        return (event: string, handler: (ev: unknown, ctx: unknown) => unknown) => {
          if (event !== "tool_call" || typeof handler !== "function") {
            return (subscribe as (...args: unknown[]) => unknown)(event, handler);
          }
          return (subscribe as (...args: unknown[]) => unknown)(
            event,
            (ev: unknown, ctx: unknown) => handler(translatePlanToolCallEvent(ev), ctx),
          );
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function helpResult(tools: Map<string, AnyTool>): AgentToolResult<unknown> {
  const lines = [`plan routes to upstream ${QUESTION_TOOL} and ${COMPLETE_TOOL} (${UPSTREAM_VERSION}):`];
  for (const op of ["question", "complete"] as const) {
    const tool = tools.get(op === "question" ? QUESTION_TOOL : COMPLETE_TOOL);
    lines.push("", `${op}: ${tool?.description ?? "(unavailable)"}`);
    lines.push(`Parameters must match this schema: ${JSON.stringify(tool?.parameters ?? {})}`);
  }
  return {
    content: [{ type: "text", text: lines.join("\n") }],
    details: { source: "plan", op: "help" },
  };
}

async function executePlan(
  tools: Map<string, AnyTool>,
  toolCallId: string,
  params: Record<string, unknown>,
  signal: AbortSignal | undefined,
  onUpdate: ((update: unknown) => void) | undefined,
  ctx: ExtensionToolContext,
): Promise<AgentToolResult<unknown>> {
  const op = params.op as Op | undefined;
  if (op === "help") return helpResult(tools);
  const name = op === "question" ? QUESTION_TOOL : op === "complete" ? COMPLETE_TOOL : undefined;
  const tool = name ? tools.get(name) : undefined;
  if (!tool) {
    throw new Error(`plan: unknown op ${JSON.stringify(op)} (expected "question", "complete", or "help")`);
  }
  // Pass only the payload key the upstream tool reads; a mismatched payload
  // then fails with the upstream "questions must be an array" / "plan must be
  // a string" error instead of silently crossing tools.
  const toolParams = op === "question" ? { questions: params.questions } : { plan: params.plan };
  const prepared = tool.prepareArguments ? tool.prepareArguments(toolParams) : toolParams;
  return tool.execute(toolCallId, prepared, signal, onUpdate as never, ctx);
}

function activate(pi: ExtensionAPI) {
    const tools = new Map<string, AnyTool>();
    (planModeActivate as (pi: ExtensionAPI) => void)(capturePi(pi, tools));
    const complete = tools.get(COMPLETE_TOOL);
    const renderCompletion = complete?.renderResult;
    if (!tools.get(QUESTION_TOOL) || !complete || !renderCompletion) {
      throw new Error(
        `plan: upstream tools missing (found: ${[...tools.keys()].join(", ") || "none"})`,
      );
    }
    const facade: AnyTool = {
      name: "plan",
      label: "Plan",
      description: FACADE_DESCRIPTION,
      parameters: FACADE_PARAMETERS,
      prepareArguments: preparePlanArguments,
      execute: (toolCallId, params, signal, onUpdate, ctx) =>
        executePlan(
          tools,
          toolCallId,
          params as Record<string, unknown>,
          signal,
          onUpdate as ((update: unknown) => void) | undefined,
          ctx,
        ),
      // Keep the upstream completion Markdown rendering for plan results;
      // question results fall back to their text content there, as upstream.
      renderResult: (result, options, theme, context) =>
        renderCompletion(result, options, theme, context),
    };
    pi.registerTool(facade);
}

export default activate;
