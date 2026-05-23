import type {
  MontageGenerateInput,
  MontageGenerateResult,
  MontageToolkit,
} from "../tools";

export type OptionalDataInfoGenerateInput = Omit<MontageGenerateInput, "dataInfo"> & {
  dataInfo?: string;
};

export interface JsonSchemaTool {
  name: "montage_generate";
  description: string;
  parameters: {
    type: "object";
    required: readonly ["prompt"];
    properties: {
      prompt: {
        type: "string";
        description: string;
      };
      dataInfo: {
        type: "string";
        description: string;
      };
      designSystem: {
        type: "object";
        description: string;
      };
      interactive: {
        type: "boolean";
        description: string;
      };
    };
  };
  execute(input: OptionalDataInfoGenerateInput): Promise<MontageGenerateResult>;
}

export const TOOL_NAME = "montage_generate" as const;

export const TOOL_DESCRIPTION =
  "Generate a production UI artifact from a prompt and data context. Use for dashboards, " +
  "reports, forms, charts, and interactive mini-apps that should return ready-to-render HTML.";

export const JSON_SCHEMA_PARAMETERS = {
  type: "object",
  required: ["prompt"],
  properties: {
    prompt: {
      type: "string",
      description:
        "Product-level render brief: goal, audience, workflow, entities, interactions, constraints, and anti-goals.",
    },
    dataInfo: {
      type: "string",
      description:
        "JSON data context, schema, or explicit empty starting state for the artifact.",
    },
    designSystem: {
      type: "object",
      description: "Optional Montage design system override.",
    },
    interactive: {
      type: "boolean",
      description:
        "Set true for mutable apps with working state and controls; omit for read-only artifacts.",
    },
  },
} as const;

export function createJsonSchemaTool(
  toolkit: MontageToolkit,
  description = TOOL_DESCRIPTION,
): JsonSchemaTool {
  return {
    name: TOOL_NAME,
    description,
    parameters: JSON_SCHEMA_PARAMETERS,
    execute: async (input: OptionalDataInfoGenerateInput): Promise<MontageGenerateResult> =>
      toolkit.execute({
        ...input,
        dataInfo: input.dataInfo ?? "",
      }),
  };
}

