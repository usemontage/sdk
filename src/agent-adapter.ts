import { normalizeMontageDesignSystem } from "./public-types";
import { MontageError } from "./errors";
import type {
  MontageCapabilityInvokeRequest,
  MontageCapabilityManifest,
  MontageCapabilitySpec,
  MontageAdapterGenerateRequest,
  MontageGenerateOutputQuality,
  MontageRenderSurface,
  MontageAdapterInvokeRequest,
  MontageAdapterTool,
} from "./types";

export interface MontageAgentDescriptor {
  id: string;
  name: string;
  description?: string;
  capabilities?: readonly string[];
}

export interface MontageAdapterOptions<TAgent extends MontageAgentDescriptor> {
  agent: TAgent;
  mcpTools?: readonly string[];
  tools?: readonly MontageAdapterTool[];
  capabilities?: readonly MontageCapabilitySpec[];
  invoke?: (
    request: MontageAdapterInvokeRequest,
  ) => Promise<MontageAdapterGenerateRequest> | MontageAdapterGenerateRequest;
  invokeCapability?: (
    request: MontageCapabilityInvokeRequest,
  ) => Promise<unknown> | unknown;
}

export interface MontageAdapter<TAgent extends MontageAgentDescriptor> {
  readonly agent: TAgent;
  readonly mcpTools: readonly string[];
  readonly tools: readonly MontageAdapterTool[];
  readonly capabilities: readonly MontageCapabilitySpec[];
  listTools(): readonly MontageAdapterTool[];
  listCapabilities(): readonly MontageCapabilitySpec[];
  getCapabilityManifest(): MontageCapabilityManifest;
  invoke(request: MontageAdapterInvokeRequest): Promise<MontageAdapterGenerateRequest>;
  invokeCapability(request: MontageCapabilityInvokeRequest): Promise<unknown> | unknown;
}

const ADAPTER_OUTPUT_QUALITIES = new Set<MontageGenerateOutputQuality>([
  "default",
  "high",
  "xhigh",
]);

function isGenerateOutputQuality(
  value: unknown,
): value is MontageGenerateOutputQuality {
  return (
    typeof value === "string"
    && ADAPTER_OUTPUT_QUALITIES.has(value as MontageGenerateOutputQuality)
  );
}

function normalizeGenerateOutputQuality(
  _value: MontageGenerateOutputQuality | undefined,
): MontageGenerateOutputQuality {
  return "default";
}

function normalizeRenderSurface(value: unknown): MontageRenderSurface | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new MontageError(
      "adapter.invalid-generate-request",
      "Montage adapter output renderSurface must be an object when provided.",
    );
  }

  const surface = value as Record<string, unknown>;
  const normalized: MontageRenderSurface = {};
  for (const key of ["width", "height", "viewportWidth", "viewportHeight", "devicePixelRatio"] as const) {
    const raw = surface[key];
    if (raw === undefined) continue;
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
      throw new MontageError(
        "adapter.invalid-generate-request",
        `Montage adapter output renderSurface.${key} must be a positive number.`,
      );
    }
    normalized[key] = raw;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function cloneTool(tool: MontageAdapterTool): MontageAdapterTool {
  return {
    ...tool,
    inputSchema: tool.inputSchema ? { ...tool.inputSchema } : undefined,
  };
}

function cloneCapability(capability: MontageCapabilitySpec): MontageCapabilitySpec {
  return {
    ...capability,
    source: capability.source ?? capability.name,
    availability: capability.availability ?? "adapter",
    inputSchema: capability.inputSchema ? { ...capability.inputSchema } : undefined,
    outputSchema: capability.outputSchema ? { ...capability.outputSchema } : undefined,
  };
}

function findCapability(
  capabilities: readonly MontageCapabilitySpec[],
  request: MontageCapabilityInvokeRequest,
): MontageCapabilitySpec | undefined {
  const source = request.source ?? request.name;
  return capabilities.find((capability) =>
    capability.name === request.name
    || capability.source === source
    || capability.name === source
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function schemaTypeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function validateJsonSchema(
  schema: unknown,
  value: unknown,
  path: string,
): string | null {
  if (!isRecord(schema)) return null;

  if ("const" in schema && value !== schema.const) {
    return `${path} must equal ${JSON.stringify(schema.const)}.`;
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    return `${path} must be one of ${schema.enum.map((entry) => JSON.stringify(entry)).join(", ")}.`;
  }

  if (typeof schema.type === "string") {
    const actual = schemaTypeOf(value);
    if (actual !== schema.type) {
      return `${path} must be ${schema.type}, received ${actual}.`;
    }
  }

  if (schema.type === "object" || isRecord(schema.properties) || Array.isArray(schema.required)) {
    if (!isRecord(value)) {
      return `${path} must be object, received ${schemaTypeOf(value)}.`;
    }
    const required = Array.isArray(schema.required)
      ? schema.required.filter((entry): entry is string => typeof entry === "string")
      : [];
    for (const key of required) {
      if (!(key in value)) return `${path}.${key} is required.`;
    }
    if (isRecord(schema.properties)) {
      for (const [key, childSchema] of Object.entries(schema.properties)) {
        if (key in value) {
          const issue = validateJsonSchema(childSchema, value[key], `${path}.${key}`);
          if (issue) return issue;
        }
      }
    }
  }

  if (schema.type === "array" || schema.items) {
    if (!Array.isArray(value)) {
      return `${path} must be array, received ${schemaTypeOf(value)}.`;
    }
    if (schema.items) {
      for (let index = 0; index < value.length; index += 1) {
        const issue = validateJsonSchema(schema.items, value[index], `${path}[${index}]`);
        if (issue) return issue;
      }
    }
  }

  return null;
}

function capabilitySchemaValue(
  schema: Record<string, unknown>,
  args: readonly unknown[],
): unknown {
  return schema.type === "array" ? args : args.length === 1 ? args[0] : args;
}

function assertCapabilitySchema(
  kind: "input" | "output",
  capability: MontageCapabilitySpec,
  value: unknown,
): void {
  const schema = kind === "input" ? capability.inputSchema : capability.outputSchema;
  if (!schema) return;
  const issue = validateJsonSchema(schema, value, kind);
  if (!issue) return;
  throw new MontageError(
    "capability.invalid-request",
    `Capability "${capability.name}" ${kind} failed schema validation: ${issue}`,
  );
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return Boolean(value && typeof value === "object" && typeof (value as { then?: unknown }).then === "function");
}

function validateCapabilityResult(
  capability: MontageCapabilitySpec,
  result: unknown,
): unknown {
  assertCapabilitySchema("output", capability, result);
  return result;
}

function normalizeGenerateRequest(
  value: unknown,
): MontageAdapterGenerateRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MontageError(
      "adapter.invalid-generate-request",
      "Montage adapters must return an object containing prompt, dataInfo, and optional outputQuality.",
    );
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  const invalidKeys = keys.filter(
    (key) =>
      key !== "prompt"
      && key !== "dataInfo"
      && key !== "outputQuality"
      && key !== "designSystem"
      && key !== "renderSurface",
  );

  if (invalidKeys.length > 0) {
    throw new MontageError(
      "adapter.invalid-generate-request",
      `Montage adapter output may only contain prompt, dataInfo, outputQuality, designSystem, and renderSurface. Found unsupported key(s): ${invalidKeys.join(", ")}.`,
    );
  }

  if (typeof record.prompt !== "string" || record.prompt.trim().length === 0) {
    throw new MontageError(
      "adapter.invalid-generate-request",
      "Montage adapter output must include a non-empty string prompt.",
    );
  }

  if (typeof record.dataInfo !== "string") {
    throw new MontageError(
      "adapter.invalid-generate-request",
      "Montage adapter output must include dataInfo as a string.",
    );
  }

  if (
    record.outputQuality !== undefined
    && !isGenerateOutputQuality(record.outputQuality)
  ) {
    throw new MontageError(
      "adapter.invalid-generate-request",
      'Montage adapter outputQuality must be "default", "high", or "xhigh".',
    );
  }

  let designSystem: MontageAdapterGenerateRequest["designSystem"];
  if (record.designSystem !== undefined) {
    try {
      designSystem = normalizeMontageDesignSystem(record.designSystem as never);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new MontageError(
        "adapter.invalid-generate-request",
        `Montage adapter output designSystem is invalid: ${message}`,
      );
    }
  }
  const renderSurface = normalizeRenderSurface(record.renderSurface);

  return {
    prompt: record.prompt,
    dataInfo: record.dataInfo,
    outputQuality: normalizeGenerateOutputQuality(
      isGenerateOutputQuality(record.outputQuality) ? record.outputQuality : undefined,
    ),
    ...(designSystem ? { designSystem } : {}),
    ...(renderSurface ? { renderSurface } : {}),
  };
}

export function createMontageAdapter<TAgent extends MontageAgentDescriptor>(
  options: MontageAdapterOptions<TAgent>,
): MontageAdapter<TAgent> {
  const tools = [...(options.tools ?? [])].map(cloneTool);
  const capabilities = [...(options.capabilities ?? [])].map(cloneCapability);

  return {
    agent: options.agent,
    mcpTools: [...(options.mcpTools ?? [])],
    tools,
    capabilities,
    listTools() {
      return tools.map(cloneTool);
    },
    listCapabilities() {
      return capabilities.map(cloneCapability);
    },
    getCapabilityManifest() {
      return {
        capabilities: capabilities.map(cloneCapability),
      };
    },
    async invoke(request) {
      const tool = tools.find((entry) => entry.name === request.tool);
      if (!tool) {
        throw new MontageError(
          "adapter.unknown-tool",
          `Unknown Montage adapter tool: "${request.tool}".`,
        );
      }

      if (!options.invoke) {
        throw new MontageError(
          "adapter.invoke-not-configured",
          "This Montage adapter does not define an invoke() handler.",
        );
      }

      const response = await options.invoke({
        tool: request.tool,
        input: request.input,
      });
      return normalizeGenerateRequest(response);
    },
    invokeCapability(request) {
      const capability = findCapability(capabilities, request);
      if (!capability) {
        throw new MontageError(
          "capability.unknown",
          `Unknown Montage capability: "${request.name}".`,
        );
      }

      if (capability.effect !== request.effect) {
        throw new MontageError(
          "capability.effect-mismatch",
          `Capability "${request.name}" is registered as "${capability.effect}", not "${request.effect}".`,
        );
      }

      if (capability.availability === "declared") {
        throw new MontageError(
          "capability.unavailable",
          `Capability "${request.name}" is declared but requires an adapter implementation.`,
        );
      }

      const source = request.source ?? capability.source ?? capability.name;
      const args = request.args ?? [];
      assertCapabilitySchema(
        "input",
        capability,
        capability.inputSchema ? capabilitySchemaValue(capability.inputSchema, args) : args,
      );

      if (!options.invokeCapability) {
        throw new MontageError(
          "capability.invoke-not-configured",
          "This Montage adapter does not define an invokeCapability() handler.",
        );
      }

      const result = options.invokeCapability({
        name: request.name,
        source,
        effect: request.effect,
        args,
        context: request.context,
      });
      return isPromiseLike(result)
        ? result.then((resolved) => validateCapabilityResult(capability, resolved))
        : validateCapabilityResult(capability, result);
    },
  };
}
