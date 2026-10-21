import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  default: activate,
  cleanPromptText,
  BASH_SNIPPET_SUFFIX,
  FILE_OPS_RULE,
  PI_VERSION,
} = await jiti.import("../index.ts");

assert.equal(PI_VERSION, "1.3.0");

describe("pinned upstream phrases", () => {
  it("suffix is 23 chars (6 tokens)", () => {
    assert.equal(BASH_SNIPPET_SUFFIX.length, 23);
  });
  it("rule ends with removable 18-char tail (5 tokens)", () => {
    assert.ok(FILE_OPS_RULE.endsWith(" like ls, rg, find"));
    assert.equal(" like ls, rg, find".length, 18);
  });
});

describe("cleanPromptText", () => {
  it("strips both phrases, leaves rest identical", () => {
    assert.equal(
      cleanPromptText(
        "- bash: Execute bash commands (ls, grep, find, etc.)\n- Use bash for file operations like ls, rg, find\n- Be concise in your responses",
      ),
      "- bash: Execute bash commands\n- Use bash for file operations\n- Be concise in your responses",
    );
  });
  it("is idempotent and spares PowerShell variants", () => {
    const variant =
      "Use bash or PowerShell for file operations like listing, searching, and finding files";
    assert.equal(cleanPromptText(variant), variant);
    const once = cleanPromptText("- bash: Execute bash commands (ls, grep, find, etc.)");
    assert.equal(cleanPromptText(once), once);
  });
});

describe("activate", () => {
  const fakePi = () => {
    const handlers = {};
    return { handlers, on: (event, handler) => { handlers[event] = handler; } };
  };
  it("mutates bash snippet and returns cleaned prompt", async () => {
    const pi = fakePi();
    activate(pi);
    const event = {
      systemPrompt:
        "- bash: Execute bash commands (ls, grep, find, etc.)\n- Use bash for file operations like ls, rg, find",
      systemPromptOptions: { toolSnippets: { bash: "Execute bash commands (ls, grep, find, etc.)" } },
    };
    const result = await pi.handlers["before_agent_start"](event);
    assert.equal(event.systemPromptOptions.toolSnippets.bash, "Execute bash commands");
    assert.equal(
      result.systemPrompt,
      "- bash: Execute bash commands\n- Use bash for file operations",
    );
  });
  it("returns undefined when prompt is already clean", async () => {
    const pi = fakePi();
    activate(pi);
    const event = {
      systemPrompt: "clean",
      systemPromptOptions: { toolSnippets: { bash: "Execute bash commands" } },
    };
    assert.equal(await pi.handlers["before_agent_start"](event), undefined);
  });
});
