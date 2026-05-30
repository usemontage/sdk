/**
 * Framework integration adapters for the Montage SDK.
 *
 * Each adapter wraps the same `execute()` function but outputs the tool
 * definition in the format that framework expects.  No framework packages
 * are imported -- the user installs their own framework and wraps the
 * returned plain object with the framework's constructor.
 */

import type {
  MontageToolkit,
  MontageGenerateInput,
  MontageGenerateResult,
} from "./tools";
import {
  isMontageAgentActionRequest,
  type MontageAgentActionHandler,
  type MontageAgentActionRequest,
  type MontageAgentActionResult,
} from "./agent-actions";

// ── Structural type for Zod -- avoids importing zod as a dependency ──

/**
 * Minimal structural type that matches the subset of Zod's `z` namespace
 * used by the adapters.  The real `z` from `"zod"` is a superset of this,
 * so the user's instance satisfies it without version conflicts.
 */
interface ZodLike {
  object: Function;
  string: Function;
  enum: Function;
  record: Function;
  unknown: Function;
}

// ── Shared helpers ──

const TOOL_NAME = "montage_generate";
const AGENT_ACTION_TOOL_NAME = "montage_agent_action";

const TOOL_DESCRIPTION =
  "Generate a rich, interactive HTML artifact — dashboards, charts, reports, " +
  "tables, forms — from a product-level render brief and structured data. " +
  "The prompt should describe goal, audience, workflow, entities, interactions, " +
  "constraints, and anti-goals; it should not contain internal source formats, raw HTML, " +
  "or a low-level layout blueprint. Upgrade vague user requests before calling: include starting state " +
  "(empty vs seeded), required controls, real file picker requirements for import/upload workflows, " +
  "data fields, design constraints, and anti-goals such as not a report or not a landing page. " +
  "Returns { html, id, creditsUsed }.";

const AGENT_ACTION_DESCRIPTION =
  "Fulfill a structured action emitted by a Montage artifact. " +
  "Use this when a generated artifact needs the host agent to answer, render new UI, " +
  "patch an artifact, create a new artifact, or run a workflow. " +
  "Returns a MontageAgentActionResult such as text, html, artifact, patch, or error.";

function buildZodSchema(z: ZodLike): unknown {
  return (z.object as Function)({
    prompt: (z.string as Function)().describe(
      "Product-level render brief: goal, audience, workflow, entities, required interactions, constraints, and anti-goals",
    ),
    dataInfo: (z.string as Function)().describe(
      "Data contract/data as a JSON string, including empty arrays, schemas, capabilities, file types, and fields when relevant",
    ),
    designSystem: (z.record as Function)((z.unknown as Function)())
      .optional()
      .describe("Optional branding override"),
  });
}

function buildAgentActionZodSchema(z: ZodLike): unknown {
  return (z.object as Function)({
    id: (z.string as Function)().optional().describe("Optional request id"),
    artifactId: (z.string as Function)().optional().describe(
      "Artifact id that emitted the action",
    ),
    revisionId: (z.string as Function)().optional().describe(
      "Revision id active when the action was emitted",
    ),
    action: (z.enum as Function)([
      "create_artifact",
      "patch_artifact",
      "answer",
      "render_ui",
      "run_workflow",
    ]).describe("Action the host agent should perform"),
    instruction: (z.string as Function)().describe(
      "Natural-language instruction from the artifact to the host agent",
    ),
    context: (z.unknown as Function)().optional().describe(
      "Optional artifact-provided context",
    ),
    ui: (z.record as Function)((z.unknown as Function)())
      .optional()
      .describe("Optional UI placement hint"),
  });
}

function agentActionError(error: unknown): MontageAgentActionResult {
  if (error instanceof Error) return { type: "error", message: error.message };
  return { type: "error", message: String(error) };
}

async function executeAgentAction(
  handler: MontageAgentActionHandler,
  input: unknown,
): Promise<MontageAgentActionResult> {
  if (!isMontageAgentActionRequest(input)) {
    return {
      type: "error",
      code: "INVALID_AGENT_ACTION",
      message: "Montage agent action request is invalid.",
    };
  }

  try {
    return await handler(input);
  } catch (error) {
    return agentActionError(error);
  }
}

const JSON_SCHEMA = {
  type: "object" as const,
  required: ["prompt", "dataInfo"],
  properties: {
    prompt: {
      type: "string",
      description:
        "Product-level render brief: goal, audience, workflow, entities, required interactions, constraints, and anti-goals. Do not emit internal source formats, raw HTML, or a low-level layout blueprint.",
    },
    dataInfo: {
      type: "string",
      description: "Data contract/data as a JSON string, including empty arrays, schemas, capabilities, file types, and fields when relevant",
    },
    designSystem: {
      type: "object",
      description: "Optional branding override",
    },
  },
} as const;

const AGENT_ACTION_JSON_SCHEMA = {
  type: "object" as const,
  required: ["action", "instruction"],
  additionalProperties: false,
  properties: {
    id: { type: "string", description: "Optional request id" },
    artifactId: {
      type: "string",
      description: "Artifact id that emitted the action",
    },
    revisionId: {
      type: "string",
      description: "Revision id active when the action was emitted",
    },
    action: {
      type: "string",
      enum: [
        "create_artifact",
        "patch_artifact",
        "answer",
        "render_ui",
        "run_workflow",
      ],
      description: "Action the host agent should perform",
    },
    instruction: {
      type: "string",
      description:
        "Natural-language instruction from the artifact to the host agent",
    },
    context: {
      description: "Optional artifact-provided context",
    },
    ui: {
      type: "object",
      additionalProperties: true,
      description: "Optional UI placement hint",
    },
  },
} as const;

export interface OpenAIResponsesFunctionTool {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
}

export interface OpenAIResponsesFunctionCallOutput {
  type: "function_call_output";
  call_id: string;
  output: string;
}

export interface OpenAIResponsesAgentActionAdapter {
  name: typeof AGENT_ACTION_TOOL_NAME;
  tool: OpenAIResponsesFunctionTool;
  execute(input: unknown): Promise<MontageAgentActionResult>;
  toOutputItem(
    call: string | Record<string, unknown>,
    result: MontageAgentActionResult,
  ): OpenAIResponsesFunctionCallOutput;
}

export interface CopilotKitAgentActionTool {
  name: typeof AGENT_ACTION_TOOL_NAME;
  description: string;
  parameters: unknown;
  handler(input: MontageAgentActionRequest): Promise<MontageAgentActionResult>;
}

function parseToolArguments(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function inputFromOpenAiToolCall(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const record = input as Record<string, unknown>;
  if ("arguments" in record) return parseToolArguments(record.arguments);
  const fn = record.function;
  if (fn && typeof fn === "object" && !Array.isArray(fn)) {
    const functionRecord = fn as Record<string, unknown>;
    if ("arguments" in functionRecord) {
      return parseToolArguments(functionRecord.arguments);
    }
  }
  return input;
}

function openAiCallId(call: string | Record<string, unknown>): string {
  if (typeof call === "string" && call.trim()) return call;
  if (typeof call !== "object" || call === null) return "";
  const callId = call.call_id ?? call.id;
  return typeof callId === "string" ? callId.trim() : "";
}

// ── Mastra ──
// Mastra tools use: { id, description, inputSchema: ZodSchema, execute }

export function mastra(toolkit: MontageToolkit, z: ZodLike) {
  return {
    id: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    inputSchema: buildZodSchema(z),
    execute: async (input: MontageGenerateInput): Promise<MontageGenerateResult> =>
      toolkit.execute(input),
  };
}

export function mastraAgentAction(
  handler: MontageAgentActionHandler,
  z: ZodLike,
) {
  return {
    id: AGENT_ACTION_TOOL_NAME,
    description: AGENT_ACTION_DESCRIPTION,
    inputSchema: buildAgentActionZodSchema(z),
    execute: async (
      input: MontageAgentActionRequest,
    ): Promise<MontageAgentActionResult> => executeAgentAction(handler, input),
  };
}

// ── LangChain ──
// DynamicStructuredTool needs: { name, description, schema, func }

export function langchain(toolkit: MontageToolkit, z: ZodLike) {
  return {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: buildZodSchema(z),
    func: async (input: MontageGenerateInput): Promise<string> => {
      const result = await toolkit.execute(input);
      return JSON.stringify(result);
    },
  };
}

export function langchainAgentAction(
  handler: MontageAgentActionHandler,
  z: ZodLike,
) {
  return {
    name: AGENT_ACTION_TOOL_NAME,
    description: AGENT_ACTION_DESCRIPTION,
    schema: buildAgentActionZodSchema(z),
    func: async (input: MontageAgentActionRequest): Promise<string> => {
      const result = await executeAgentAction(handler, input);
      return JSON.stringify(result);
    },
  };
}

// ── Vercel AI SDK ──
// tool() from "ai" accepts: { description, parameters: zodSchema, execute }

export function vercelAi(toolkit: MontageToolkit, z: ZodLike) {
  return {
    description: TOOL_DESCRIPTION,
    parameters: buildZodSchema(z),
    execute: async (input: MontageGenerateInput): Promise<MontageGenerateResult> =>
      toolkit.execute(input),
  };
}

export function vercelAiAgentAction(
  handler: MontageAgentActionHandler,
  z: ZodLike,
) {
  return {
    description: AGENT_ACTION_DESCRIPTION,
    parameters: buildAgentActionZodSchema(z),
    execute: async (
      input: MontageAgentActionRequest,
    ): Promise<MontageAgentActionResult> => executeAgentAction(handler, input),
  };
}

// ── Raw / Generic ──
// Framework-agnostic definition with JSON Schema.  Works with any framework
// that accepts a JSON Schema + execute function.

export function raw(toolkit: MontageToolkit) {
  return {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: JSON_SCHEMA,
    execute: async (input: MontageGenerateInput): Promise<MontageGenerateResult> =>
      toolkit.execute(input),
  };
}

export function rawAgentAction(handler: MontageAgentActionHandler) {
  return {
    name: AGENT_ACTION_TOOL_NAME,
    description: AGENT_ACTION_DESCRIPTION,
    schema: AGENT_ACTION_JSON_SCHEMA,
    execute: async (input: unknown): Promise<MontageAgentActionResult> =>
      executeAgentAction(handler, input),
  };
}

// ── OpenAI Responses API ──
// Responses tools use top-level { type: "function", name, parameters }.
// The adapter accepts either raw arguments or a function_call item.

export function openaiResponsesAgentAction(
  handler: MontageAgentActionHandler,
): OpenAIResponsesAgentActionAdapter {
  return {
    name: AGENT_ACTION_TOOL_NAME,
    tool: {
      type: "function",
      name: AGENT_ACTION_TOOL_NAME,
      description: AGENT_ACTION_DESCRIPTION,
      parameters: AGENT_ACTION_JSON_SCHEMA,
    },
    execute: async (input: unknown): Promise<MontageAgentActionResult> =>
      executeAgentAction(handler, inputFromOpenAiToolCall(input)),
    toOutputItem(
      call: string | Record<string, unknown>,
      result: MontageAgentActionResult,
    ): OpenAIResponsesFunctionCallOutput {
      const callId = openAiCallId(call);
      if (!callId) {
        throw new Error("OpenAI function_call output requires call_id.");
      }
      return {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(result),
      };
    },
  };
}

// ── CopilotKit / AG-UI frontend tools ──
// CopilotKit v2 `useFrontendTool` accepts { name, description, parameters,
// handler }. The caller passes their own Zod-compatible `z` instance.

export function copilotKitAgentAction(
  handler: MontageAgentActionHandler,
  z: ZodLike,
): CopilotKitAgentActionTool {
  return {
    name: AGENT_ACTION_TOOL_NAME,
    description: AGENT_ACTION_DESCRIPTION,
    parameters: buildAgentActionZodSchema(z),
    handler: async (
      input: MontageAgentActionRequest,
    ): Promise<MontageAgentActionResult> => executeAgentAction(handler, input),
  };
}
