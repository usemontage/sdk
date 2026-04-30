import type { MontageDesignSystemConfig } from "./public-types";

export type { MontageDesignSystemConfig } from "./public-types";

export interface MontageToolsConfig {
  apiKey: string;
  apiUrl?: string;
  defaults?: {
    designSystem?: MontageDesignSystemConfig;
    outputQuality?: "default" | "high" | "xhigh";
    renderSurface?: {
      width?: number;
      height?: number;
      viewportWidth?: number;
      viewportHeight?: number;
      devicePixelRatio?: number;
    };
  };
}

export interface MontageGenerateInput {
  prompt: string;
  dataInfo: string;
  outputQuality?: "default" | "high" | "xhigh";
  designSystem?: MontageDesignSystemConfig;
}

export interface MontageGenerateResult {
  id: string;
  html: string;
  creditsUsed: number;
}

export interface AnthropicToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface OpenAIToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface MontageToolkit {
  execute(input: MontageGenerateInput): Promise<MontageGenerateResult>;
  anthropic(): AnthropicToolDefinition[];
  openai(): OpenAIToolDefinition[];
}

export class MontageApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "MontageApiError";
    this.code = code;
    this.status = status;
  }
}

const DEFAULT_API_URL = "https://api.usemontage.ai";
const DEFAULT_OUTPUT_QUALITY = "default";

function normalizeOutputQuality(
  _value?: "default" | "high" | "xhigh",
): "default" {
  return DEFAULT_OUTPUT_QUALITY;
}

const TOOL_DESCRIPTION = `Generate a rich, interactive HTML artifact — dashboards, charts, reports, tables, forms, pipelines, or any visual UI — from a natural-language render brief and structured data. Call this instead of returning markdown tables or plain-text lists whenever the user wants something visual.

"prompt": A product-level render brief. Include the user goal, audience, workflow, entities, required interactions, constraints, and anti-goals. Do not emit internal source formats, raw HTML, or a low-level layout blueprint.
"dataInfo": The actual data contract/data as a JSON string. Include real values when available, or explicit empty arrays/schemas/capabilities when the artifact starts empty. For import/upload workflows, include expected file types and row fields.
"outputQuality": Use "default" only. Other values are ignored for now.
"designSystem": Optional theme/branding override. Set brand colors, dark/light mode, typography.

Before calling this tool, upgrade vague user requests into a render brief:
- Goal and audience: who uses the artifact and why.
- Primary workflow: what the user should do first, second, third.
- Entities and fields: records, metrics, time series, statuses, owners, dates.
- Starting state: explicitly say empty vs seeded/sample. Creation/tracker apps should start empty unless the user asked for sample data.
- Required interactions: add/create/edit/delete, search/filter, select row, import/upload, export/download, tabs/views.
- Import/upload requirements: say the control must expose a real file picker and name accepted file types/fields. Do not ask Montage for an import modal that only lists required columns.
- Visual constraints: design system, density, style, and anti-goals such as "not a report", "no marketing landing page", "first screen is the app".

Good prompt example: "Interactive fundraising pipeline for a startup CFO. Start with no investor rows. User can add investors, import a CSV with firm/partner/stage/target/probability/nextStep/owner fields through a real file picker, filter by stage/search, and export visible rows. Use Montage Default light SaaS styling. First screen should be the app workspace, not a report or landing page."

Returns { html, id, creditsUsed } — "html" is the rendered artifact ready to display.`;

const INPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["prompt", "dataInfo"],
  properties: {
    prompt: {
      type: "string",
      description:
        "Product-level render brief: goal, audience, workflow, entities, required interactions, constraints, and anti-goals. Do not emit internal source formats, raw HTML, or a low-level layout blueprint.",
    },
    dataInfo: {
      type: "string",
      description:
        "The data contract/data as a JSON string. Include real values when available, or explicit empty arrays, schemas, capabilities, file types, and fields for empty/import-driven apps.",
    },
    outputQuality: {
      type: "string",
      enum: ["default"],
      description:
        'Render quality. Use "default" only.',
    },
    designSystem: {
      type: "object",
      description:
        "Optional branding override. Set theme, palette, or custom brand colors.",
    },
  },
};

function mergeDesignSystem(
  defaults?: MontageDesignSystemConfig,
  overrides?: MontageDesignSystemConfig,
): MontageDesignSystemConfig | undefined {
  if (!defaults && !overrides) return undefined;
  if (!defaults) return overrides;
  if (!overrides) return defaults;

  return {
    ...defaults,
    ...overrides,
    colors: {
      ...defaults.colors,
      ...overrides.colors,
    },
  };
}

export function createMontageTools(config: MontageToolsConfig): MontageToolkit {
  const apiUrl = config.apiUrl ?? DEFAULT_API_URL;

  return {
    async execute(input: MontageGenerateInput): Promise<MontageGenerateResult> {
      const designSystem = mergeDesignSystem(
        config.defaults?.designSystem,
        input.designSystem,
      );

      const outputQuality = normalizeOutputQuality(
        input.outputQuality ?? config.defaults?.outputQuality,
      );

      const body: Record<string, unknown> = {
        prompt: input.prompt,
        dataInfo: input.dataInfo,
        outputQuality,
      };

      if (designSystem) {
        body.designSystem = designSystem;
      }
      if (config.defaults?.renderSurface) {
        body.renderSurface = config.defaults.renderSurface;
      }

      let response: Response;
      try {
        response = await fetch(`${apiUrl}/v1/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify(body),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        throw new MontageApiError(
          "network",
          0,
          `Montage API request failed: ${message}`,
        );
      }

      if (!response.ok) {
        let errorBody: {
          code?: string;
          message?: string;
          error?: { code?: string; message?: string };
        } = {};
        try {
          errorBody = (await response.json()) as typeof errorBody;
        } catch {
          // response body is not JSON
        }

        // The Montage API returns errors as `{ success: false, error: { code, message } }`,
        // but legacy/edge responses sometimes use top-level `code` / `message`.
        // Prefer the nested shape, fall back to the top-level fields.
        const errorObj = errorBody.error ?? errorBody;

        throw new MontageApiError(
          errorObj.code ?? "api_error",
          response.status,
          errorObj.message ??
            `Montage API returned ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as {
        id: string;
        html?: string;
        artifact?: { html?: string };
        creditsUsed: number;
      };
      const html = typeof data.html === "string" ? data.html : data.artifact?.html;
      if (typeof html !== "string") {
        throw new MontageApiError(
          "invalid_response",
          response.status,
          "Montage API response did not include bundled HTML.",
        );
      }

      return {
        id: data.id,
        html,
        creditsUsed: data.creditsUsed,
      };
    },

    anthropic(): AnthropicToolDefinition[] {
      return [
        {
          name: "montage_generate",
          description: TOOL_DESCRIPTION,
          input_schema: INPUT_SCHEMA,
        },
      ];
    },

    openai(): OpenAIToolDefinition[] {
      return [
        {
          type: "function",
          function: {
            name: "montage_generate",
            description: TOOL_DESCRIPTION,
            parameters: INPUT_SCHEMA,
          },
        },
      ];
    },
  };
}
