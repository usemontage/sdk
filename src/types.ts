import type {
  MontageDesignSystem,
  MontageDesignSystemConfig,
} from "./public-types";

export type {
  MontageDesignSystem,
  MontageDesignSystemConfig,
} from "./public-types";

export type SubmissionValue =
  | string
  | number
  | File
  | boolean
  | Record<string, unknown>
  | null
  | Array<string | number | File | boolean | Record<string, unknown> | null>;

export type MontageGenerateOutputQuality = "default" | "high" | "xhigh";

export type MontageBackendType = "fluxAOT" | "fluxUI";

export interface MontageRenderSurface {
  width?: number;
  height?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  devicePixelRatio?: number;
}

export type MontageCapabilityEffect = "pure" | "query" | "effect";

export type MontageCapabilityAvailability = "runtime" | "adapter" | "declared";

export interface MontageCapabilitySpec {
  name: string;
  source?: string;
  effect: MontageCapabilityEffect;
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  availability?: MontageCapabilityAvailability;
}

export interface MontageCapabilityInvokeRequest {
  name: string;
  source?: string;
  effect: MontageCapabilityEffect;
  args?: unknown[];
  context?: unknown;
}

export interface MontageCapabilityManifest {
  capabilities: MontageCapabilitySpec[];
}

export interface ArtifactRef {
  id: string;
  kind: "csv" | "json" | "html" | "pdf" | "xlsx" | "docx";
  name: string;
  mimeType: string;
  url?: string;
  previewHtml?: string;
  metadata?: Record<string, unknown>;
}

export interface JobRef {
  id: string;
  status: "queued" | "running" | "complete" | "failed" | "cancelled";
  progress?: number;
  result?: unknown;
  error?: string;
}

export interface MontageAdapterTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface MontageAdapterInvokeRequest {
  tool: string;
  input?: unknown;
}

export interface MontageAdapterGenerateRequest {
  prompt: string;
  dataInfo: string;
  outputQuality: MontageGenerateOutputQuality;
  /**
   * Caller may pass a partial design-system config; the adapter normalizes
   * it to a full `MontageDesignSystem` before returning. Typed as the
   * narrower full system to keep downstream consumers safe, while remaining
   * structurally compatible with config inputs.
   */
  designSystem?: MontageDesignSystem | MontageDesignSystemConfig;
  backendType?: MontageBackendType;
  renderSurface?: MontageRenderSurface;
}

/**
 * Typed error shape emitted by the SDK.
 */
export interface MontageRenderError extends Error {
  code: MontageErrorCode;
  cause?: unknown;
}

export type MontageErrorCode =
  | "adapter.invoke-not-configured"
  | "adapter.unknown-tool"
  | "adapter.invalid-generate-request"
  | "capability.invoke-not-configured"
  | "capability.unknown"
  | "capability.effect-mismatch"
  | "capability.unavailable"
  | "capability.invalid-request";
