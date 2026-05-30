export { createMontageTools } from "./tools";
export * as integrations from "./integrations";
export type {
  MontageToolsConfig,
  MontageToolkit,
  MontageGenerateInput,
  MontageGenerateResult,
  MontageGenerateStreamEvent,
  MontageGenerationDiagnostic,
  MontageArtifactCacheMode,
  MontageArtifactCapabilityInput,
  MontageArtifactConstraints,
  MontageArtifactContext,
  MontageArtifactDetail,
  MontageArtifactListOptions,
  MontageArtifactListResult,
  MontageArtifactMethods,
  MontageArtifactPatchMode,
  MontageArtifactTemplateDetail,
  MontageArtifactTemplateListOptions,
  MontageArtifactTemplateListResult,
  MontageArtifactTemplateMethods,
  MontageArtifactTemplateMutationResult,
  MontageArtifactTemplateSummary,
  MontageArtifactTemplateVisibility,
  MontageArtifactRevisionDetail,
  MontageArtifactRevisionListOptions,
  MontageArtifactRevisionListResult,
  MontageArtifactRevisionSummary,
  MontageArtifactSummary,
  MontageCreateArtifactInput,
  MontageCreateArtifactResult,
  MontageCreateArtifactTemplateInput,
  MontageCreateDeploymentInput,
  MontageCreateOrgInput,
  MontageDeploymentAuthPolicy,
  MontageDeploymentAgentPolicy,
  MontageDeploymentAgentPolicyMode,
  MontageDeploymentAgentActionEvent,
  MontageDeploymentAgentActionUsage,
  MontageDeploymentAgentActionUsageOptions,
  MontageDeploymentCachePolicy,
  MontageDeploymentCacheScope,
  MontageDeploymentListOptions,
  MontageDeploymentListResult,
  MontageDeploymentMethods,
  MontageDeploymentMode,
  MontageDeploymentProofPolicy,
  MontageDeploymentProofPolicyMode,
  MontageDeploymentStatus,
  MontageDeploymentSummary,
  MontageForkArtifactTemplateInput,
  MontageForkArtifactTemplateResult,
  MontagePatchArtifactInput,
  MontagePromoteDeploymentInput,
  MontageOrgDetail,
  MontageOrgKind,
  MontageOrgListOptions,
  MontageOrgListResult,
  MontageOrgMemberListOptions,
  MontageOrgMemberListResult,
  MontageOrgMemberMutationResult,
  MontageOrgMemberSummary,
  MontageOrgMethods,
  MontageOrgMutationResult,
  MontageOrgRole,
  MontageOrgSummary,
  MontageUpdateDeploymentInput,
  MontageUpsertOrgMemberInput,
  MontageStreamCapabilityAlias,
  MontageStreamCapabilityAliasContext,
  MontageStreamSurface,
  MontageStreamSurfaceOptions,
  AdapterConfigSummary,
  MontageAdapterMethods,
  MontageStreamOptions,
  MontageStreamResult,
  MontageFragmentResult,
  MontageGenerateFragmentResult,
} from "./tools";
export { MontageApiError } from "./tools";
export { createMontageStreamSurface } from "./tools";
export { normalizeMontageStreamEvent } from "./tools";
export { readMontageSseResponse } from "./tools";
export { MontageError } from "./errors";
export { createMontageAdapter } from "./agent-adapter";
export {
  dispatchMontageAgentAction,
  installMontageAgentActionHandler,
  isMontageAgentActionRequest,
  MONTAGE_AGENT_ACTION_EVENT,
} from "./agent-actions";
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
  MontageAgentActionEvent,
  MontageAgentActionEventDetail,
  MontageAgentActionHandler,
  MontageAgentActionMode,
  MontageAgentActionName,
  MontageAgentActionRequest,
  MontageAgentActionResult,
} from "./agent-actions";
export type {
  MontageAdapterGenerateRequest,
  MontageAdapterInvokeRequest,
  MontageAdapterTool,
  MontageRenderSurface,
} from "./types";
export type {
  MontageCapabilityBridgeErrorContext,
  MontageCapabilityBridgeEvent,
  MontageCapabilityBridgeEventPhase,
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
