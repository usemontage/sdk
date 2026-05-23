export { createMontageTools } from "./tools";
export * as integrations from "./integrations";
export type {
  MontageToolsConfig,
  MontageToolkit,
  MontageGenerateInput,
  MontageGenerateResult,
  MontageGenerateStreamEvent,
  MontageGenerationDiagnostic,
  MontageStreamSurface,
  AdapterConfigSummary,
  MontageAdapterMethods,
  MontageStreamOptions,
  MontageStreamResult,
  MontageFragmentResult,
  MontageGenerateFragmentResult,
} from "./tools";
export { MontageApiError } from "./tools";
export { createMontageStreamSurface } from "./tools";
export { readMontageSseResponse } from "./tools";
export { MontageError } from "./errors";
export { createMontageAdapter } from "./agent-adapter";
export { bindMontageCapabilityBridge } from "./capability-bridge";
export {
  installCapabilityBridge,
  uninstallCapabilityBridge,
} from "./capability-bridge-runtime";
export { mountHtmlBlock } from "./html/mount-html-block";
export { mountShadowBlock } from "./html/mount-shadow-block";

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
  MontageRenderSurface,
} from "./types";
export type {
  MontageCapabilityBridgeErrorContext,
  MontageCapabilityBridgeOptions,
} from "./capability-bridge";
export type {
  CapabilityInvokeArgs,
  InstallBridgeArgs,
  InstallSdkBridgeArgs,
  MontageAOTRuntime,
} from "./capability-bridge-runtime";
export type { MountedHtmlBlockOptions } from "./html/mount-html-block";
export type { MountedShadowBlockOptions } from "./html/mount-shadow-block";
