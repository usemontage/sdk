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

const TOOL_DESCRIPTION =
  "Generate a rich, interactive HTML artifact — dashboards, charts, reports, " +
  "tables, forms — from a product-level render brief and structured data. " +
  "The prompt should describe goal, audience, workflow, entities, interactions, " +
  "constraints, and anti-goals; it should not contain FluxUI, Artifact IR, raw HTML, " +
  "or a low-level layout blueprint. Upgrade vague user requests before calling: include starting state " +
  "(empty vs seeded), required controls, real file picker requirements for import/upload workflows, " +
  "data fields, design constraints, and anti-goals such as not a report or not a landing page. " +
  "Returns { html, id, creditsUsed }.";

function buildZodSchema(z: ZodLike): unknown {
  return (z.object as Function)({
    prompt: (z.string as Function)().describe(
      "Product-level render brief: goal, audience, workflow, entities, required interactions, constraints, and anti-goals",
    ),
    dataInfo: (z.string as Function)().describe(
      "Data contract/data as a JSON string, including empty arrays, schemas, capabilities, file types, and fields when relevant",
    ),
    outputQuality: (z.enum as Function)(["default"])
      .optional()
      .describe('Render quality. Use "default" only.'),
    designSystem: (z.record as Function)((z.unknown as Function)())
      .optional()
      .describe("Optional branding override"),
  });
}

const JSON_SCHEMA = {
  type: "object" as const,
  required: ["prompt", "dataInfo"],
  properties: {
    prompt: {
      type: "string",
      description:
        "Product-level render brief: goal, audience, workflow, entities, required interactions, constraints, and anti-goals. Do not emit FluxUI, Artifact IR, raw HTML, or a low-level layout blueprint.",
    },
    dataInfo: {
      type: "string",
      description: "Data contract/data as a JSON string, including empty arrays, schemas, capabilities, file types, and fields when relevant",
    },
    outputQuality: {
      type: "string",
      enum: ["default"],
      description: 'Render quality. Use "default" only.',
    },
    designSystem: {
      type: "object",
      description: "Optional branding override",
    },
  },
} as const;

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
