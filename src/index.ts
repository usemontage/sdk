export { createMontageTools } from "./tools";
export * as integrations from "./integrations";
export type {
  MontageToolsConfig,
  MontageToolkit,
  MontageGenerateInput,
  MontageGenerateResult,
} from "./tools";
export { MontageApiError } from "./tools";
export { MontageError } from "./errors";
export { createMontageAdapter } from "./agent-adapter";
export { bindMontageCapabilityBridge } from "./capability-bridge";
export { mountHtmlBlock } from "./html/mount-html-block";
export {
  createMontageAiSdkTool,
  createMontageVercelAiTool,
  montageAiSdkTool,
} from "./ai-sdk";
export { createMontageMastraTool, montageMastraTool } from "./mastra";

export type {
  MontageCapabilityAvailability,
  MontageCapabilityEffect,
  MontageCapabilityInvokeRequest,
  MontageCapabilityManifest,
  MontageCapabilitySpec,
  MontageErrorCode,
  MontageRenderError,
  ArtifactRef,
  JobRef,
} from "./types";
export type {
  MontageAdapter,
  MontageAdapterOptions,
  MontageAgentDescriptor,
} from "./agent-adapter";
export type {
  MontageAdapterGenerateRequest,
  MontageAdapterInvokeRequest,
  MontageAdapterTool,
  MontageGenerateOutputQuality,
  MontageRenderSurface,
} from "./types";
export type {
  MontageCapabilityBridgeErrorContext,
  MontageCapabilityBridgeOptions,
} from "./capability-bridge";
export type { MountedHtmlBlockOptions } from "./html/mount-html-block";
export type { MontageAiSdkToolConfig } from "./ai-sdk";
export type { MontageMastraTool } from "./mastra";
