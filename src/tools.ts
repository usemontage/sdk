import type {
  MontageDesignSystemConfig,
  MontageDesignSystemSource,
  MontageGenerateFragmentResult,
} from "./public-types";
import { mountHtmlBlock } from "./html/mount-html-block";
import {
  extractHtmlBlockPayload,
  normalizeHtmlBlockPayload,
} from "./html/html-block-payload";
import type { MontageAdapter, MontageAgentDescriptor } from "./agent-adapter";
import type { MontageCapabilityBridgeEvent } from "./capability-bridge";
import { installCapabilityBridge } from "./capability-bridge-runtime";
import type {
  MontageCapabilityErrorHandler,
  MontageCapabilityEffect,
  MontageCapabilityManifest,
  MontageCapabilitySpec,
  MontageGenerationResolution,
} from "./types";

export type { MontageDesignSystemConfig } from "./public-types";
export type {
  MontageFragmentResult,
  MontageGenerateFragmentResult,
} from "./public-types";

export interface MontageToolsConfig {
  apiKey: string;
  apiUrl?: string;
  /**
   * Additional headers sent with SDK API calls.
   * Authorization is always derived from apiKey and cannot be overridden here.
   */
  headers?: Record<string, string>;
  defaults?: {
    designSystem?: MontageDesignSystemConfig;
    renderSurface?: {
      width?: number;
      height?: number;
      viewportWidth?: number;
      viewportHeight?: number;
      devicePixelRatio?: number;
    };
  };
}

export type MontageTextInput =
  | string
  | Array<{
      role?: string;
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>;
    }>;

export interface MontageGenerateInput {
  input?: MontageTextInput;
  prompt?: string;
  dataInfo: string;
  data?: unknown;
  title?: string;
  designSystem?: MontageDesignSystemConfig;
  adapter?: MontageAdapter<MontageAgentDescriptor>;
  artifactId?: string;
  hosted?: boolean;
  strictData?: boolean;
  requiredFields?: string[];
  requiredCapabilities?: string[];
  cache?: "read-write" | "read" | "write" | "skip" | "read-through";
  /** True when mutable app collections should start empty rather than seeded. */
  zeroed?: boolean;
  /**
   * Set to `true` when the user wants a fully working app (state, controls that
   * mutate data, create/import/edit/delete flows). Default `false` renders a
   * static brief/report/comparison — board-ready output without behavior.
   * Charts and inspectors still get hover/tooltips in either mode.
   */
  interactive?: boolean;
  /** Caller-generated request ID for tracing and log correlation. */
  requestId?: string;
  /** When true, fragment responses also include the full bundled HTML. */
  includeHtml?: boolean;
}

export interface MontageGenerationDiagnostic {
  code: string;
  severity: "error" | "warning";
  phase: string;
  message: string;
  path?: string;
  suggestion?: string;
  [key: string]: unknown;
}

export interface MontageGenerateResult {
  id: string;
  html: string;
  creditsUsed: number;
  artifactId?: string;
  version?: string;
  htmlBundleRef?: string | null;
  hostedUrl?: string;
  resolution?: MontageGenerationResolution;
  diagnostics?: MontageGenerationDiagnostic[];
}

export interface AdapterConfigSummary {
  provider: string;
  configuredAt: string;
  keys: string[];
}

export interface MontageAdapterMethods {
  configure(provider: string, config: Record<string, string>): Promise<void>;
  list(): Promise<AdapterConfigSummary[]>;
  remove(provider: string): Promise<void>;
}

export type MontageArtifactCacheMode =
  | "read-write"
  | "read"
  | "write"
  | "skip"
  | "read-through";

export type MontageArtifactCapabilityInput =
  | string
  | (Pick<MontageCapabilitySpec, "name"> &
      Partial<Omit<MontageCapabilitySpec, "name">>);

export interface MontageArtifactContext {
  artifactId?: string;
  dataInfo?: string;
  data?: unknown;
  designSystem?: MontageDesignSystemConfig;
  designSystemVersionId?: string;
  capabilities?: MontageArtifactCapabilityInput[];
  renderSurface?: {
    width?: number;
    height?: number;
    viewportWidth?: number;
    viewportHeight?: number;
    devicePixelRatio?: number;
  };
  publicEnv?: Record<string, string>;
  providerEnv?: Record<string, string>;
  deployment?: unknown;
}

export interface MontageArtifactConstraints {
  cache?: MontageArtifactCacheMode;
  hosted?: boolean;
  interactive?: boolean;
  zeroed?: boolean;
  strictData?: boolean;
  requiredFields?: string[];
  requiredCapabilities?: string[];
}

export interface MontageCreateArtifactInput {
  input?: MontageTextInput;
  request?: string;
  prompt?: string;
  context?: MontageArtifactContext;
  constraints?: MontageArtifactConstraints;
  dataInfo?: string;
  title?: string;
  backendType?: "fluxAOT" | "fluxUI";
  designSystem?: MontageDesignSystemConfig;
  designSystemVersionId?: string;
  renderSurface?: MontageArtifactContext["renderSurface"];
  seed?: string;
  cache?: MontageArtifactCacheMode;
  interactive?: boolean;
  zeroed?: boolean;
  strictData?: boolean;
  requiredFields?: string[];
  requiredCapabilities?: string[];
  data?: unknown;
  publicEnv?: Record<string, string>;
  providerEnv?: Record<string, string>;
  requestId?: string;
  artifactId?: string;
  hosted?: boolean;
  adapter?: MontageAdapter<MontageAgentDescriptor>;
}

export type MontageArtifactPatchMode =
  | "auto"
  | "source_patch"
  | "signature_patch"
  | "design_patch"
  | "full_regen";

export interface MontagePatchArtifactInput extends Omit<
  MontageCreateArtifactInput,
  "request" | "artifactId"
> {
  instruction: string;
  baseRevisionId?: string;
  mode?: MontageArtifactPatchMode;
}

export interface MontageArtifactSummary {
  artifactId: string;
  userId?: string;
  orgId?: string;
  currentRevisionId?: string | null;
  currentVersion?: string | null;
  title?: string | null;
  description?: string | null;
  visibility?: "private" | "org" | "public" | string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MontageArtifactDetail extends MontageArtifactSummary {
  ir?: unknown;
}

export interface MontageUpdateArtifactInput {
  title?: string | null;
  description?: string | null;
  visibility?: "private" | "org" | "public";
}

export interface MontageUpdateArtifactResult {
  artifact: MontageArtifactSummary;
}

export interface MontageArtifactRevisionQuality {
  diagnosticCount?: number;
  repairIterations?: number;
  validatorPassedFirstTry?: boolean;
  componentCount?: number;
  chartCount?: number;
  interactiveElementCount?: number;
  shellType?: string | null;
}

export interface MontageArtifactRevisionSummary {
  revisionId: string;
  versionId?: string;
  contentHash?: string;
  parentRevisionId?: string | null;
  parentId?: string | null;
  createdAt?: string;
  createdByPath?: string;
  instruction?: string | null;
  changeSummary?: string | null;
  signature?: unknown | null;
  source?: string | null;
  htmlBundleRef?: string | null;
  qaStatus?: "pending" | "passed" | "warning" | "failed" | null;
  designSystemVersionId?: string | null;
  operation?: string | null;
  hasGraphArtifacts?: boolean;
  quality?: MontageArtifactRevisionQuality;
}

export interface MontageArtifactRevisionDetail extends MontageArtifactRevisionSummary {
  artifactId?: string;
  ir?: unknown;
  graphArtifacts?: unknown | null;
}

export interface MontageCreateArtifactResult {
  artifact: MontageArtifactSummary;
  revision: {
    revisionId: string;
    version?: string | null;
  } | null;
  generation: {
    id: string;
    creditsUsed: number;
    resolution?: MontageGenerationResolution;
    diagnostics?: MontageGenerationDiagnostic[];
    graphArtifacts?: unknown;
  };
  html: string;
  hostedUrl?: string;
  proof?: MontageRevisionProofSummary;
}

export interface MontageRestoreArtifactInput {
  instruction?: string;
}

export interface MontageRollbackArtifactInput {
  revisionId?: string;
  instruction?: string;
}

export interface MontageForkArtifactInput {
  revisionId?: string;
  instruction?: string;
}

export interface MontageArtifactLifecycleResult {
  artifact: MontageArtifactSummary;
  revision: MontageArtifactRevisionSummary & { artifactId?: string };
  restoredFrom?: {
    artifactId: string;
    revisionId: string;
  };
  forkedFrom?: {
    artifactId: string;
    revisionId: string;
  };
  rolledBackFrom?: {
    artifactId: string;
    revisionId: string;
  };
}

export interface MontageArtifactExportOptions {
  revisionId?: string;
  format?: "json";
}

export interface MontageArtifactExportFile {
  path: string;
  contentType: string;
  encoding?: "utf-8" | string;
  bytes?: number;
  content: string;
}

export interface MontageArtifactExportBundle {
  artifact: MontageArtifactSummary;
  revision: MontageArtifactRevisionSummary & { artifactId?: string };
  export: {
    format: "montage.artifact.v1";
    exportedAt: string;
  };
  bundle: {
    ir: unknown;
    contentHash?: string;
    graphArtifacts?: unknown | null;
    htmlBundleRef?: string | null;
    metadata?: Record<string, unknown>;
  };
}

export interface MontageArtifactHtmlExport {
  artifactId: string;
  revisionId?: string;
  html: string;
  contentType: string;
}

export interface MontageArtifactArchiveExport {
  artifact: MontageArtifactSummary;
  revision: MontageArtifactRevisionSummary & { artifactId?: string };
  export: {
    format: "montage.artifact-archive.v1";
    exportedAt: string;
    files: MontageArtifactExportFile[];
  };
}

export interface MontageCompareArtifactRevisionsInput {
  baseRevisionId: string;
  targetRevisionId: string;
}

export interface MontageArtifactRevisionComparison {
  artifactId: string;
  baseRevision: MontageArtifactRevisionSummary;
  targetRevision: MontageArtifactRevisionSummary;
  comparison: {
    sameContent?: boolean;
    sameHtmlBundle?: boolean;
    sameDesignSystemVersion?: boolean;
    operationChanged?: boolean;
    qaStatusChanged?: boolean;
    graphArtifactsChanged?: boolean;
    [key: string]: unknown;
  };
}

export type MontageRevisionProofStatus =
  | "pending"
  | "passed"
  | "warning"
  | "failed";

export type MontageRevisionProofAssetKind =
  | "screenshot"
  | "trace"
  | "video"
  | "report"
  | "html"
  | "json"
  | "asset";

export interface MontageRevisionProofAssetSummary {
  assetId: string;
  proofId: string;
  orgId?: string;
  artifactId: string;
  revisionId: string;
  kind: MontageRevisionProofAssetKind;
  label: string;
  filename?: string | null;
  mimeType: string;
  byteLength: number;
  sha256: string;
  metadata?: Record<string, unknown>;
  url: string;
  createdAt?: string;
}

export interface MontageRevisionProofSummary {
  proofId: string;
  orgId?: string;
  artifactId: string;
  revisionId: string;
  status: MontageRevisionProofStatus;
  summary?: string | null;
  checks?: unknown[];
  diagnostics?: unknown[];
  evidence?: Record<string, unknown>;
  assets?: MontageRevisionProofAssetSummary[];
  createdByUserId?: string | null;
  createdAt?: string;
}

export interface MontageCreateRevisionProofInput {
  status: MontageRevisionProofStatus;
  summary?: string | null;
  checks?: unknown[];
  diagnostics?: unknown[];
  evidence?: Record<string, unknown>;
}

export interface MontageRunRevisionProofInput {
  targetUrl?: string;
  html?: string;
  outputDir?: string;
  generationId?: string;
  timeoutMs?: number;
}

export interface MontageRevisionProofMutationResult {
  proof: MontageRevisionProofSummary;
  revision?: {
    revisionId: string;
    qaStatus?: MontageRevisionProofStatus | null;
  };
}

export interface MontageRevisionProofListOptions {
  limit?: number;
  offset?: number;
}

export interface MontageRevisionProofListResult {
  artifactId: string;
  revisionId: string;
  proofs: MontageRevisionProofSummary[];
  limit?: number;
  offset?: number;
}

export interface MontageRevisionProofDetail {
  artifactId: string;
  revisionId: string;
  proof: MontageRevisionProofSummary;
}

export interface MontageRevisionProofAssetListResult {
  artifactId: string;
  revisionId: string;
  proofId: string;
  assets: MontageRevisionProofAssetSummary[];
}

export interface MontageArtifactListOptions {
  limit?: number;
  offset?: number;
}

export interface MontageArtifactRevisionListOptions {
  limit?: number;
}

export interface MontageArtifactListResult {
  artifacts: MontageArtifactSummary[];
  limit?: number;
  offset?: number;
}

export interface MontageArtifactRevisionListResult {
  artifactId: string;
  revisions: MontageArtifactRevisionSummary[];
}

export interface MontageArtifactMethods {
  create(
    input: MontageCreateArtifactInput,
  ): Promise<MontageCreateArtifactResult>;
  streamCreate(
    input: MontageCreateArtifactInput,
    onEvent: (
      event: MontageGenerateStreamEvent,
      rawChunk: string,
    ) => void | Promise<void>,
    options?: { signal?: AbortSignal },
  ): Promise<void>;
  update(
    artifactId: string,
    input: MontageUpdateArtifactInput,
  ): Promise<MontageUpdateArtifactResult>;
  patch(
    artifactId: string,
    input: MontagePatchArtifactInput,
  ): Promise<MontageCreateArtifactResult>;
  restyle(
    artifactId: string,
    input: MontagePatchArtifactInput,
  ): Promise<MontageCreateArtifactResult>;
  list(
    options?: MontageArtifactListOptions,
  ): Promise<MontageArtifactListResult>;
  get(artifactId: string): Promise<MontageArtifactDetail>;
  listRevisions(
    artifactId: string,
    options?: MontageArtifactRevisionListOptions,
  ): Promise<MontageArtifactRevisionListResult>;
  getRevision(
    artifactId: string,
    revisionId: string,
  ): Promise<MontageArtifactRevisionDetail>;
  restore(
    artifactId: string,
    revisionId: string,
    input?: MontageRestoreArtifactInput,
  ): Promise<MontageArtifactLifecycleResult>;
  rollback(
    artifactId: string,
    input?: MontageRollbackArtifactInput,
  ): Promise<MontageArtifactLifecycleResult>;
  fork(
    artifactId: string,
    input?: MontageForkArtifactInput,
  ): Promise<MontageArtifactLifecycleResult>;
  export(
    artifactId: string,
    options?: MontageArtifactExportOptions,
  ): Promise<MontageArtifactExportBundle>;
  exportHtml(
    artifactId: string,
    options?: Pick<MontageArtifactExportOptions, "revisionId">,
  ): Promise<MontageArtifactHtmlExport>;
  exportArchive(
    artifactId: string,
    options?: Pick<MontageArtifactExportOptions, "revisionId">,
  ): Promise<MontageArtifactArchiveExport>;
  compareRevisions(
    artifactId: string,
    input: MontageCompareArtifactRevisionsInput,
  ): Promise<MontageArtifactRevisionComparison>;
  createProof(
    artifactId: string,
    revisionId: string,
    input: MontageCreateRevisionProofInput,
  ): Promise<MontageRevisionProofMutationResult>;
  runProof(
    artifactId: string,
    revisionId: string,
    input?: MontageRunRevisionProofInput,
  ): Promise<MontageRevisionProofMutationResult>;
  listProofs(
    artifactId: string,
    revisionId: string,
    options?: MontageRevisionProofListOptions,
  ): Promise<MontageRevisionProofListResult>;
  getProof(
    artifactId: string,
    revisionId: string,
    proofId: string,
  ): Promise<MontageRevisionProofDetail>;
  listProofAssets(
    artifactId: string,
    revisionId: string,
    proofId: string,
  ): Promise<MontageRevisionProofAssetListResult>;
}

export type MontageDeploymentMode =
  | "preview"
  | "share"
  | "embed"
  | "app"
  | "export";

export type MontageDeploymentStatus = "draft" | "active" | "revoked";
export type MontageDeploymentCacheScope = "public" | "private" | "no-store";
export type MontageDeploymentProofPolicyMode =
  | "strict"
  | "allow-warnings"
  | "manual";
export type MontageDeploymentAgentPolicyMode = "event" | "proxy" | "disabled";

export interface MontageDeploymentAuthPolicy {
  type?: "none" | "jwks";
  jwksUrl?: string;
}

export interface MontageDeploymentCachePolicy {
  scope?: MontageDeploymentCacheScope;
  maxAgeSeconds?: number;
  staleWhileRevalidateSeconds?: number;
}

export interface MontageDeploymentProofPolicy {
  mode?: MontageDeploymentProofPolicyMode;
  requiredCheckIds?: string[];
  allowFailedChecks?: boolean;
}

export interface MontageDeploymentAgentPolicy {
  mode?: MontageDeploymentAgentPolicyMode;
  webhookUrl?: string | null;
  allowedActions?: string[];
  timeoutMs?: number;
}

export interface MontageCreateDeploymentInput {
  artifactId: string;
  revisionId?: string;
  mode?: MontageDeploymentMode;
  slug?: string;
  auth?: MontageDeploymentAuthPolicy;
  bindings?: Record<string, unknown>;
  allowedOrigins?: string[];
  frameAncestors?: string[];
  cachePolicy?: MontageDeploymentCachePolicy;
  proofPolicy?: MontageDeploymentProofPolicy;
  agentPolicy?: MontageDeploymentAgentPolicy;
}

export type MontageUpdateDeploymentInput = Omit<
  MontageCreateDeploymentInput,
  "artifactId" | "revisionId"
>;

export interface MontagePromoteDeploymentInput {
  revisionId: string;
}

export interface MontageDeploymentSummary {
  deploymentId: string;
  orgId?: string;
  artifactId: string;
  revisionId?: string | null;
  slug?: string | null;
  mode?: MontageDeploymentMode;
  status?: MontageDeploymentStatus;
  cachePolicy?: MontageDeploymentCachePolicy | null;
  proofPolicy?: MontageDeploymentProofPolicy | null;
  agentPolicy?: MontageDeploymentAgentPolicy | null;
  hostedUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  promotedAt?: string | null;
}

export interface MontageDeploymentListOptions {
  limit?: number;
  offset?: number;
}

export interface MontageDeploymentListResult {
  deployments: MontageDeploymentSummary[];
  limit?: number;
  offset?: number;
}

export type MontageDeploymentCacheStatus =
  | "cold"
  | "warm"
  | "stale"
  | "invalidated";

export interface MontageDeploymentCacheBundle {
  ref: string;
  contentHash?: string | null;
  byteLength?: number | null;
  updatedAt?: string | null;
}

export interface MontageDeploymentCacheSummary {
  deploymentId: string;
  artifactId: string;
  revisionId: string;
  status: MontageDeploymentCacheStatus;
  htmlBundleRef?: string | null;
  invalidatedRef?: string;
  prewarmed?: boolean;
  bundle?: MontageDeploymentCacheBundle;
}

export interface MontageDeploymentCapabilityEvent {
  capabilityName: string;
  effect: "query" | "effect";
  source?: string | null;
  latencyMs?: number | null;
  success: boolean;
  errorCode?: string | null;
  createdAt: string;
}

export type MontageDeploymentUsageHealthStatus =
  | "idle"
  | "healthy"
  | "degraded"
  | "failing";

export interface MontageDeploymentUsageHealth {
  status: MontageDeploymentUsageHealthStatus;
  reasons: string[];
  failureRate: number | null;
  avgLatencyMs: number | null;
  lastErrorCode: string | null;
}

export interface MontageDeploymentCapabilityUsage {
  deploymentId: string;
  totals: {
    calls: number;
    successes: number;
    failures: number;
    successRate: number | null;
  };
  health: MontageDeploymentUsageHealth;
  capabilities: Array<{
    capabilityName: string;
    calls: number;
    successes: number;
    failures: number;
    avgLatencyMs: number | null;
    lastCalledAt: string | null;
    lastErrorCode: string | null;
    health: MontageDeploymentUsageHealth;
  }>;
  recentEvents: MontageDeploymentCapabilityEvent[];
}

export interface MontageDeploymentCapabilityUsageOptions {
  limit?: number;
  since?: string;
}

export interface MontageDeploymentAgentActionEvent {
  action: string;
  mode: MontageDeploymentAgentPolicyMode;
  source?: string | null;
  latencyMs?: number | null;
  success: boolean;
  errorCode?: string | null;
  createdAt: string;
}

export interface MontageDeploymentAgentActionUsage {
  deploymentId: string;
  totals: {
    calls: number;
    successes: number;
    failures: number;
    successRate: number | null;
  };
  health: MontageDeploymentUsageHealth;
  actions: Array<{
    action: string;
    calls: number;
    successes: number;
    failures: number;
    avgLatencyMs: number | null;
    lastCalledAt: string | null;
    lastErrorCode: string | null;
    health: MontageDeploymentUsageHealth;
  }>;
  recentEvents: MontageDeploymentAgentActionEvent[];
}

export interface MontageDeploymentAgentActionUsageOptions {
  limit?: number;
  since?: string;
}

export type MontageOrgRole = "owner" | "admin" | "editor" | "viewer";
export type MontageOrgKind = "personal" | "team" | "enterprise";

export interface MontageOrgSummary {
  orgId: string;
  name: string;
  slug?: string;
  kind?: MontageOrgKind;
  role?: MontageOrgRole | null;
  createdByUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MontageOrgMemberSummary {
  orgId: string;
  userId: string;
  role: MontageOrgRole;
  createdAt?: string;
}

export interface MontageOrgListOptions {
  limit?: number;
  offset?: number;
}

export interface MontageOrgListResult {
  orgs: MontageOrgSummary[];
  limit?: number;
  offset?: number;
}

export interface MontageCreateOrgInput {
  name: string;
  slug?: string;
  kind?: MontageOrgKind;
}

export interface MontageOrgMutationResult {
  org: MontageOrgSummary;
  member: MontageOrgMemberSummary;
}

export interface MontageOrgDetail {
  org: MontageOrgSummary;
}

export interface MontageOrgMemberListOptions {
  limit?: number;
  offset?: number;
}

export interface MontageOrgMemberListResult {
  orgId: string;
  members: MontageOrgMemberSummary[];
  limit?: number;
  offset?: number;
}

export interface MontageUpsertOrgMemberInput {
  userId: string;
  role: MontageOrgRole;
}

export interface MontageOrgMemberMutationResult {
  member: MontageOrgMemberSummary;
}

export interface MontageOrgMethods {
  create(input: MontageCreateOrgInput): Promise<MontageOrgMutationResult>;
  list(options?: MontageOrgListOptions): Promise<MontageOrgListResult>;
  get(orgId: string): Promise<MontageOrgDetail>;
  listMembers(
    orgId: string,
    options?: MontageOrgMemberListOptions,
  ): Promise<MontageOrgMemberListResult>;
  upsertMember(
    orgId: string,
    input: MontageUpsertOrgMemberInput,
  ): Promise<MontageOrgMemberMutationResult>;
}

export interface MontageDeploymentMethods {
  create(
    input: MontageCreateDeploymentInput,
  ): Promise<MontageDeploymentSummary>;
  list(
    options?: MontageDeploymentListOptions,
  ): Promise<MontageDeploymentListResult>;
  get(deploymentId: string): Promise<MontageDeploymentSummary>;
  update(
    deploymentId: string,
    input: MontageUpdateDeploymentInput,
  ): Promise<MontageDeploymentSummary>;
  promote(
    deploymentId: string,
    input: MontagePromoteDeploymentInput,
  ): Promise<MontageDeploymentSummary>;
  revoke(deploymentId: string): Promise<MontageDeploymentSummary>;
  getCache(deploymentId: string): Promise<MontageDeploymentCacheSummary>;
  invalidateCache(deploymentId: string): Promise<MontageDeploymentCacheSummary>;
  prewarmCache(deploymentId: string): Promise<MontageDeploymentCacheSummary>;
  getCapabilityUsage(
    deploymentId: string,
    options?: MontageDeploymentCapabilityUsageOptions,
  ): Promise<MontageDeploymentCapabilityUsage>;
  getAgentActionUsage(
    deploymentId: string,
    options?: MontageDeploymentAgentActionUsageOptions,
  ): Promise<MontageDeploymentAgentActionUsage>;
}

export interface MontageDesignSystemSummary {
  designSystemId: string;
  orgId?: string;
  name: string;
  currentVersionId?: string | null;
  createdByUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MontageDesignSystemVersionSummary {
  versionId: string;
  designSystemId: string;
  source?: Record<string, unknown>;
  tokens: Record<string, unknown>;
  components?: Record<string, unknown>;
  rules?: Record<string, unknown>;
  assets?: Record<string, unknown>;
  createdByUserId?: string | null;
  createdAt?: string;
}

export interface MontageDesignSystemMutationResult {
  designSystem: MontageDesignSystemSummary;
  version: MontageDesignSystemVersionSummary | null;
  forkedFrom?: {
    designSystemId: string;
    versionId?: string | null;
  };
}

export interface MontageDesignSystemDetail {
  designSystem: MontageDesignSystemSummary;
  currentVersion: MontageDesignSystemVersionSummary | null;
}

export interface MontageDesignSystemListOptions {
  limit?: number;
  offset?: number;
}

export interface MontageDesignSystemListResult {
  designSystems: MontageDesignSystemSummary[];
  limit?: number;
  offset?: number;
}

export interface MontageCreateDesignSystemInput {
  name: string;
  designSystem?: MontageDesignSystemConfig;
  source?: Partial<MontageDesignSystemSource>;
  components?: Record<string, unknown>;
  rules?: Record<string, unknown>;
  assets?: Record<string, unknown>;
}

export interface MontageUpdateDesignSystemInput {
  name?: string;
  designSystem?: MontageDesignSystemConfig;
  source?: Partial<MontageDesignSystemSource>;
  components?: Record<string, unknown>;
  rules?: Record<string, unknown>;
  assets?: Record<string, unknown>;
}

export interface MontageForkDesignSystemInput {
  name: string;
  versionId?: string;
}

export interface MontageDesignSystemMethods {
  create(
    input: MontageCreateDesignSystemInput,
  ): Promise<MontageDesignSystemMutationResult>;
  list(
    options?: MontageDesignSystemListOptions,
  ): Promise<MontageDesignSystemListResult>;
  get(designSystemId: string): Promise<MontageDesignSystemDetail>;
  update(
    designSystemId: string,
    input: MontageUpdateDesignSystemInput,
  ): Promise<MontageDesignSystemMutationResult>;
  fork(
    designSystemId: string,
    input: MontageForkDesignSystemInput,
  ): Promise<MontageDesignSystemMutationResult>;
  import(
    input: MontageCreateDesignSystemInput,
  ): Promise<MontageDesignSystemMutationResult>;
}

export type MontageArtifactTemplateVisibility = "private" | "org" | "public";

export interface MontageArtifactTemplateSummary {
  templateId: string;
  orgId?: string;
  artifactId: string;
  revisionId: string;
  name: string;
  description?: string | null;
  tags?: string[];
  visibility?: MontageArtifactTemplateVisibility;
  metadata?: Record<string, unknown>;
  createdByUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MontageCreateArtifactTemplateInput {
  artifactId: string;
  revisionId?: string;
  name: string;
  description?: string | null;
  tags?: string[];
  visibility?: MontageArtifactTemplateVisibility;
  metadata?: Record<string, unknown>;
}

export interface MontageArtifactTemplateMutationResult {
  template: MontageArtifactTemplateSummary;
}

export interface MontageArtifactTemplateDetail {
  template: MontageArtifactTemplateSummary;
}

export interface MontageArtifactTemplateListOptions {
  limit?: number;
  offset?: number;
}

export interface MontageArtifactTemplateListResult {
  templates: MontageArtifactTemplateSummary[];
  limit?: number;
  offset?: number;
}

export interface MontageForkArtifactTemplateInput {
  instruction?: string;
}

export interface MontageForkArtifactTemplateResult {
  template: MontageArtifactTemplateSummary;
  artifact: MontageArtifactSummary;
  revision: MontageArtifactRevisionSummary & { artifactId?: string };
  forkedFrom: {
    artifactId: string;
    revisionId: string;
  };
}

export interface MontageArtifactTemplateMethods {
  create(
    input: MontageCreateArtifactTemplateInput,
  ): Promise<MontageArtifactTemplateMutationResult>;
  list(
    options?: MontageArtifactTemplateListOptions,
  ): Promise<MontageArtifactTemplateListResult>;
  get(templateId: string): Promise<MontageArtifactTemplateDetail>;
  fork(
    templateId: string,
    input?: MontageForkArtifactTemplateInput,
  ): Promise<MontageForkArtifactTemplateResult>;
}

export type MontageGenerateStreamEvent =
  | { type: "status"; text: string; [key: string]: unknown }
  | {
      type: "shell";
      html: string;
      cacheKey?: string;
      text?: string;
      [key: string]: unknown;
    }
  | {
      type: "slot";
      slot: string;
      html: string;
      cacheKey?: string;
      text?: string;
      [key: string]: unknown;
    }
  | {
      type: "done" | "artifact";
      html?: string;
      parts?: {
        fragment: string;
        styles?: string;
        stylesheets?: string[];
        scripts?: string[];
        externalScripts?: string[];
      };
      id?: string;
      creditsUsed?: number;
      cacheKey?: string;
      artifactId?: string;
      version?: string;
      htmlBundleRef?: string | null;
      hostedUrl?: string;
      resolution?: MontageGenerationResolution;
      diagnostics?: MontageGenerationDiagnostic[];
      text?: string;
      [key: string]: unknown;
    }
  | { type: "error"; text: string; [key: string]: unknown };

export interface MontageStreamResult {
  html: string;
  parts?: {
    fragment: string;
    styles?: string;
    stylesheets?: string[];
    scripts?: string[];
    externalScripts?: string[];
  };
  id?: string;
  creditsUsed?: number;
  cacheKey?: string;
  artifactId?: string;
  version?: string;
  htmlBundleRef?: string | null;
  hostedUrl?: string;
  resolution?: MontageGenerationResolution;
  diagnostics?: MontageGenerationDiagnostic[];
  cleanup(): void;
  abort(): void;
}

export interface MontageStreamOptions {
  target: HTMLElement | HTMLIFrameElement;
  mountMode?: "inline" | "shadow";
  signal?: AbortSignal;
  adapter?: MontageAdapter<MontageAgentDescriptor>;
  context?: Record<string, unknown>;
  onCapabilityError?: MontageCapabilityErrorHandler;
  onCapabilityEvent?: (event: MontageCapabilityBridgeEvent) => void;
  capabilityAliases?: MontageStreamCapabilityAlias[];
  onStatus?: (text: string) => void;
  onDone?: (result: MontageStreamResult) => void;
  onError?: (error: MontageApiError) => void;
  /**
   * Run the artifact's own scripts as the stream renders into `target`.
   * Defaults to true. Set false when the host re-renders the finished artifact
   * itself (e.g. inside an isolated iframe) — the SDK then streams a script-free,
   * declarative preview so artifact JS never executes in the host window, which
   * avoids leaked timers/animation loops and DOM nodes appended outside `target`.
   */
  previewScripts?: boolean;
  /**
   * Advanced diagnostic hook. The default SDK path applies shell/slot/done
   * internally and only exposes public rendered HTML events here.
   */
  onEvent?: (event: MontageGenerateStreamEvent, rawChunk: string) => void;
}

export interface MontageStreamSurface {
  applyEvent(event: MontageGenerateStreamEvent): Promise<void>;
  cleanup(): void;
}

export interface MontageStreamCapabilityAliasContext {
  element: HTMLElement;
  event: MouseEvent;
  root: Document | ShadowRoot | HTMLElement;
  target: HTMLElement | HTMLIFrameElement;
}

export interface MontageStreamCapabilityAlias {
  name: string;
  source?: string;
  effect?: MontageCapabilityEffect;
  labels: Array<string | RegExp>;
  args?: unknown | ((context: MontageStreamCapabilityAliasContext) => unknown);
}

export interface MontageStreamSurfaceOptions {
  mountMode?: "inline" | "shadow";
  /** See MontageStreamOptions.previewScripts. Defaults to true. */
  previewScripts?: boolean;
  adapter?: MontageAdapter<MontageAgentDescriptor>;
  context?: unknown;
  onCapabilityError?: MontageCapabilityErrorHandler;
  onCapabilityEvent?: (event: MontageCapabilityBridgeEvent) => void;
  capabilityAliases?: MontageStreamCapabilityAlias[];
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
  adapters: MontageAdapterMethods;
  orgs: MontageOrgMethods;
  artifacts: MontageArtifactMethods;
  designSystems: MontageDesignSystemMethods;
  templates: MontageArtifactTemplateMethods;
  deployments: MontageDeploymentMethods;
  execute(input: MontageGenerateInput): Promise<MontageGenerateResult>;
  stream(
    input: MontageGenerateInput,
    options: MontageStreamOptions,
  ): Promise<MontageStreamResult>;
  executeStreaming(
    input: MontageGenerateInput,
    onEvent: (event: MontageGenerateStreamEvent, rawChunk: string) => void,
    options?: { signal?: AbortSignal },
  ): Promise<void>;
  executeFragment(
    input: MontageGenerateInput,
  ): Promise<MontageGenerateFragmentResult>;
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
const STREAM_SLOT_PAINT_SETTLE_MS = 350;
const GENERATED_REQUEST_ID_PREFIX = "mtg";

const TOOL_DESCRIPTION = `Generate a rich, interactive HTML artifact — dashboards, charts, reports, tables, forms, pipelines, or any visual UI — from a natural-language render brief and structured data. Call this instead of returning markdown tables or plain-text lists whenever the user wants something visual.

"input": OpenAI-style alias for the natural-language artifact request. Prefer this for agent integrations that already use Responses-style input.
"prompt": A product-level render brief. Include the user goal, audience, workflow, entities, required interactions, constraints, and anti-goals. Do not emit private renderer formats, raw HTML, or a low-level layout blueprint.
"dataInfo": The actual data contract/data as a JSON string. Include real values when available, or explicit empty arrays/schemas/capabilities when the artifact starts empty. For import/upload workflows, include expected file types and row fields.
"data": Optional pre-fetched data for static accuracy or initial render. Use adapter capabilities for data that must stay live after the artifact is shipped or hosted.
"hosted": Set to true when the final artifact should be persisted and returned with a stable hosted URL.
"strictData": Defaults to true. Montage fails closed when required fields or capabilities cannot be validated.
"requiredFields" and "requiredCapabilities": Use these for must-not-omit data contracts. Required capabilities are dispatched through the capability bridge at render time.
"interactive": Set to true ONLY when the user wants a fully working app — state, controls that mutate data, add/import/edit/delete flows, search/filter that actually filters, etc. Set to false (default) for briefs, reports, comparisons, summaries, dashboards-as-screenshots, and any read-only artifact. Charts and tooltips work in either mode; this flag is about whether the artifact has behavior, not whether it has hover effects.
"zeroed": Set to true when mutable record collections should start empty instead of seeded/sample populated.
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

function buildDefaultRequestId(): string {
  const random =
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2, 14);
  return `${GENERATED_REQUEST_ID_PREFIX}_${random.slice(0, 24)}`;
}

function resolveRequestId(requestId: string | undefined): string {
  const explicit = requestId?.trim();
  if (explicit) {
    const sanitized = explicit.replace(/[^A-Za-z0-9_.-]+/g, "_").slice(0, 120);
    if (sanitized.length > 0) return sanitized;
  }
  return buildDefaultRequestId();
}

const INPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["dataInfo"],
  anyOf: [{ required: ["prompt"] }, { required: ["input"] }],
  properties: {
    input: {
      description:
        "OpenAI-style natural-language artifact request. May be a string or a Responses-style input message array.",
    },
    prompt: {
      type: "string",
      description:
        "Product-level render brief: goal, audience, workflow, entities, required interactions, constraints, and anti-goals. Do not emit private renderer formats, raw HTML, or a low-level layout blueprint.",
    },
    dataInfo: {
      type: "string",
      description:
        "The data contract/data as a JSON string. Include real values when available, or explicit empty arrays, schemas, capabilities, file types, and fields for empty/import-driven apps.",
    },
    data: {
      description:
        "Optional pre-fetched data for static accuracy or initial render. Use adapter capabilities for live or hosted data.",
    },
    hosted: {
      type: "boolean",
      description:
        "True when Montage should return a stable hosted artifact URL in addition to HTML.",
    },
    strictData: {
      type: "boolean",
      description:
        "Defaults to true. When true, Montage fails closed if required fields or capabilities cannot be validated.",
    },
    requiredFields: {
      type: "array",
      items: { type: "string" },
      description:
        "Data fields that must be available and represented by the generated artifact.",
    },
    requiredCapabilities: {
      type: "array",
      items: { type: "string" },
      description:
        "Adapter capability names that must be wired into the generated artifact through MontageAOT.invoke.",
    },
    designSystem: {
      type: "object",
      description:
        "Optional branding override. Set theme, palette, or custom brand colors.",
    },
    interactive: {
      type: "boolean",
      description:
        "True when the artifact should be a fully working app (state, handlers, add/import/edit/delete, search/filter that actually filters). False (default) produces a static brief/report/comparison/dashboard-as-screenshot. Defaults to false when omitted.",
    },
    zeroed: {
      type: "boolean",
      description:
        "True when mutable record collections should start empty rather than seeded/sample populated.",
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

function isIframeTarget(
  target: HTMLElement | HTMLIFrameElement,
): target is HTMLIFrameElement {
  return target.tagName.toLowerCase() === "iframe";
}

function isDocumentRoot(root: Document | ShadowRoot): root is Document {
  return root.nodeType === 9;
}

function isShadowRoot(
  root: Document | ShadowRoot | ParentNode,
): root is ShadowRoot {
  return root.nodeType === 11 && "host" in root;
}

function escapeCssSelector(value: string, ownerDocument: Document): string {
  const css = ownerDocument.defaultView?.CSS ?? globalThis.CSS;
  if (typeof css?.escape === "function") return css.escape(value);
  return value.replace(/["\\#.;?+*~':!^$[\]()=>|/@]/g, "\\$&");
}

function htmlToFragment(
  ownerDocument: Document,
  html: string,
): DocumentFragment {
  const template = ownerDocument.createElement("template");
  const parserCtor =
    ownerDocument.defaultView?.DOMParser ?? globalThis.DOMParser;
  if (/<(?:!doctype|html|head|body)(?:\s|>)/i.test(html) && parserCtor) {
    const parsed = new parserCtor().parseFromString(html, "text/html");
    const headAssets = Array.from(
      parsed.head.querySelectorAll("link[rel='stylesheet'],style,script"),
    )
      .map((node) => node.outerHTML)
      .join("");
    template.innerHTML = `${headAssets}${parsed.body.innerHTML}`;
  } else {
    template.innerHTML = html;
  }
  return template.content.cloneNode(true) as DocumentFragment;
}

function stringFromEvent(
  payload: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function eventTextLooksLikeHtml(value: string | undefined): value is string {
  return Boolean(
    value && /<(?:!doctype|html|head|body|[a-z][\w:-]*)(?:\s|>)/i.test(value),
  );
}

function htmlFromStreamPayload(
  payload: Record<string, unknown>,
): string | undefined {
  const html = stringFromEvent(payload, ["html"]);
  if (html !== undefined) return html;
  const text = stringFromEvent(payload, ["text", "delta", "content"]);
  return eventTextLooksLikeHtml(text) ? text : undefined;
}

function slotFromStreamPayload(
  payload: Record<string, unknown>,
): string | undefined {
  const explicit = stringFromEvent(payload, [
    "slot",
    "section",
    "sectionId",
    "target",
    "id",
    "name",
  ]);
  if (explicit !== undefined) return explicit;

  const index = payload.sectionIndex ?? payload.index;
  if (typeof index === "number" && Number.isFinite(index)) {
    return `section-${Math.max(0, Math.trunc(index)) + 1}`;
  }
  return undefined;
}

export function normalizeMontageStreamEvent(
  event: unknown,
): MontageGenerateStreamEvent | null {
  if (!event || typeof event !== "object") return null;
  const payload = event as Record<string, unknown>;
  const type = typeof payload.type === "string" ? payload.type : "";

  if (type === "status") {
    const text = stringFromEvent(payload, ["text", "message", "status"]) ?? "";
    return { ...payload, type: "status", text };
  }

  if (type === "error") {
    const text =
      stringFromEvent(payload, ["text", "message", "error"]) ??
      "Montage stream failed.";
    return { ...payload, type: "error", text };
  }

  if (type === "shell") {
    const html = htmlFromStreamPayload(payload);
    return html === undefined ? null : { ...payload, type: "shell", html };
  }

  if (type === "slot" || type === "section" || type === "section-append") {
    const slot = slotFromStreamPayload(payload);
    const html = htmlFromStreamPayload(payload);
    if (!slot || html === undefined) return null;
    return { ...payload, type: "slot", slot, html };
  }

  if (type === "done" || type === "artifact") {
    const html = htmlFromStreamPayload(payload);
    return html === undefined
      ? { ...payload, type }
      : { ...payload, type, html };
  }

  return null;
}

function stringArrayFromUnknown(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries = value.filter(
    (entry): entry is string =>
      typeof entry === "string" && entry.trim().length > 0,
  );
  return entries.length > 0 ? entries : undefined;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

interface MountedStreamSlot {
  html: string;
  styles?: string;
  stylesheets?: string[];
}

function findParsedStreamSlot(
  root: ParentNode,
  slot: string,
): HTMLElement | null {
  for (const element of Array.from(
    root.querySelectorAll<HTMLElement>("[data-mtg-stream-slot]"),
  )) {
    if (element.getAttribute("data-mtg-stream-slot") === slot) return element;
  }
  return null;
}

function htmlForMountedStreamSlot(
  slot: string,
  mounted: MountedStreamSlot,
): string {
  const assets: string[] = [];
  for (const href of mounted.stylesheets ?? []) {
    assets.push(`<link rel="stylesheet" href="${escapeHtmlAttribute(href)}">`);
  }
  if (mounted.styles?.trim()) {
    assets.push(
      `<style data-mtg-slot-style="${escapeHtmlAttribute(slot)}">${mounted.styles}</style>`,
    );
  }
  assets.push(mounted.html);
  return assets.join("\n");
}

function buildBestEffortStreamHtml(
  target: HTMLElement | HTMLIFrameElement,
  shellHtml: string | null,
  mountedSlots: Map<string, MountedStreamSlot>,
): string | undefined {
  if (!shellHtml || mountedSlots.size === 0) return undefined;
  const ownerDocument = isIframeTarget(target)
    ? (target.contentDocument ?? target.ownerDocument)
    : target.ownerDocument;
  const parserCtor =
    ownerDocument.defaultView?.DOMParser ?? globalThis.DOMParser;
  if (!parserCtor) return undefined;

  const isFullDocument = /<(?:!doctype|html|head|body)(?:\s|>)/i.test(
    shellHtml,
  );
  const parsed = new parserCtor().parseFromString(shellHtml, "text/html");
  const fallbackContainer =
    parsed.querySelector<HTMLElement>("[data-mtg-stream-slots]") ?? parsed.body;
  let inserted = false;

  for (const [slot, mounted] of mountedSlots) {
    const slotHtml = htmlForMountedStreamSlot(slot, mounted);
    const template = parsed.createElement("template");
    template.innerHTML = slotHtml;
    const slotElement = findParsedStreamSlot(parsed, slot);
    if (slotElement) {
      slotElement.replaceWith(template.content);
    } else {
      fallbackContainer.appendChild(template.content);
    }
    inserted = true;
  }

  for (const leftover of Array.from(
    parsed.querySelectorAll("[data-mtg-stream-slot]"),
  )) {
    leftover.remove();
  }

  if (!inserted) return undefined;
  return isFullDocument
    ? `<!doctype html>\n${parsed.documentElement.outerHTML}`
    : parsed.body.innerHTML;
}

function htmlFromFinalStreamParts(
  event: MontageGenerateStreamEvent,
): string | undefined {
  const eventRecord = event as Record<string, unknown>;
  const parts = eventRecord.parts;
  if (!parts || typeof parts !== "object") return undefined;
  const record = parts as Record<string, unknown>;
  const fragment =
    typeof record.fragment === "string" ? record.fragment : undefined;
  const htmlPayload =
    typeof eventRecord.html === "string"
      ? extractHtmlBlockPayload(eventRecord.html)
      : undefined;
  const styles = [
    htmlPayload?.styles,
    typeof record.styles === "string" ? record.styles : undefined,
  ].filter((entry): entry is string => Boolean(entry?.trim()));
  const payload = normalizeHtmlBlockPayload({
    fragment: fragment ?? htmlPayload?.fragment,
    styles: styles.length > 0 ? styles.join("\n\n") : undefined,
    stylesheets: [
      ...(htmlPayload?.stylesheets ?? []),
      ...(stringArrayFromUnknown(record.stylesheets) ?? []),
    ],
    scripts: [
      ...(htmlPayload?.scripts ?? []),
      ...(stringArrayFromUnknown(record.scripts) ?? []),
    ],
    externalScripts: [
      ...(htmlPayload?.externalScripts ?? []),
      ...(stringArrayFromUnknown(record.externalScripts) ?? []),
    ],
  });
  const headNodes: string[] = [];
  for (const stylesheet of payload.stylesheets ?? []) {
    headNodes.push(
      `<link rel="stylesheet" href="${escapeHtmlAttribute(stylesheet)}">`,
    );
  }
  if (payload.styles?.trim()) {
    headNodes.push(`<style>${payload.styles}</style>`);
  }
  const bodyNodes: string[] = [];
  if (payload.fragment.trim()) {
    bodyNodes.push(payload.fragment);
  }
  for (const src of payload.externalScripts ?? []) {
    bodyNodes.push(`<script src="${escapeHtmlAttribute(src)}"></script>`);
  }
  for (const script of payload.scripts ?? []) {
    bodyNodes.push(`<script>${script}</script>`);
  }
  if (headNodes.length === 0 && bodyNodes.length === 0) return undefined;
  return `<!DOCTYPE html>\n<html><head>${headNodes.join("\n")}</head><body>${bodyNodes.join("\n")}</body></html>`;
}

function writeIframeDocument(iframe: HTMLIFrameElement, html: string): void {
  iframe.srcdoc = html;
  const doc = iframe.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
}

// Streaming entrance: choreographed fade-in for each slot as it arrives.
//
// CONTRACT WITH THE RENDERER:
//   CSS `transform` on an SVG element fully REPLACES its `transform` attribute
//   (they don't compose — see CSS Transforms Level 1). So any SVG <g> with a
//   class targeted below MUST NOT carry a `transform=""` attribute; positioning
//   transforms must live on an unclassed outer <g> wrapper. The atlas chart
//   renderer enforces this (see chart/index.html `legend()` helper).
//   The invariant is verified by atlas-chart-animation-contract.test.ts.
const STREAM_TRANSITION_CSS = `
[data-mtg-stream-slot]:not([data-mtg-stream-filled]){display:none}
[data-mtg-stream-slot][data-mtg-stream-filled]{display:block;width:100%;max-width:100%;min-width:0;opacity:0;transform:translateY(8px);animation:mtg-stream-enter .34s cubic-bezier(.25,.46,.45,.94) both}
[data-mtg-stream-slots]{display:block;width:100%;max-width:100%;min-width:0}
[data-mtg-streaming] .mtg-report-grid-row{flex-direction:column!important;gap:0!important}
[data-mtg-streaming] .mtg-report-grid-item,[data-mtg-streaming] .mtg-report-grid-item--full{flex:none!important;width:100%!important;max-width:100%!important}
[data-mtg-streaming] .mtg-full-render-body{display:flex!important;flex-direction:column!important;grid-template-columns:none!important}
[data-mtg-streaming] .mtg-full-render-rail{border-left:none!important;border-top:none!important}
[data-mtg-streaming] .mtg-dashboard-grid{display:flex!important;flex-direction:column!important;grid-template-columns:none!important}
[data-mtg-streaming] .mtg-dashboard-region{width:100%!important;max-width:100%!important}
[data-mtg-streaming] .mtg-stack[data-direction="row"]{flex-direction:column!important}
[data-mtg-streaming] .mtg-stack[data-direction="row"]>*{flex:1 1 auto!important}
[data-mtg-streaming] .mtg-report-section,[data-mtg-streaming] .mtg-report-band,[data-mtg-streaming] .mtg-aot-inline-section,[data-mtg-streaming] .mtg-report-chart-wrap,[data-mtg-streaming] .mtg-report-table-shell{width:100%!important;max-width:100%!important;min-width:0!important}
@media(max-width:480px){
.mtg-report-grid-row{flex-direction:column!important;gap:0!important}
.mtg-report-grid-item,.mtg-report-grid-item--full{flex:none!important;width:100%!important;max-width:100%!important}
.mtg-full-render-body{display:flex!important;flex-direction:column!important;grid-template-columns:none!important}
.mtg-full-render-rail{border-left:none!important;border-top:none!important}
.mtg-dashboard-grid{display:flex!important;flex-direction:column!important;grid-template-columns:none!important}
.mtg-dashboard-region{width:100%!important;max-width:100%!important}
.mtg-stack[data-direction="row"]{flex-direction:column!important}
.mtg-stack[data-direction="row"]>*{flex:1 1 auto!important}
.mtg-report-section,.mtg-report-band,.mtg-aot-inline-section,.mtg-report-chart-wrap,.mtg-report-table-shell{width:100%!important;max-width:100%!important;min-width:0!important}
.mtg-report-chart-wrap,.mtg-report-chart-wrap--compact{overflow-x:auto;-webkit-overflow-scrolling:touch}
.mtg-report-chart-svg{min-width:480px}
.mtg-report-kpi-block{flex:1 1 100%}
.mtg-report-kpi-main{gap:12px}
.mtg-report-kpi-value{font-size:1.75rem}
.mtg-report-kpi-secondary{grid-template-columns:1fr}
}
@keyframes mtg-stream-enter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes mtg-stream-number{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
@keyframes mtg-stream-bar{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes mtg-stream-line{from{stroke-dashoffset:var(--mtg-dash-len,1000)}to{stroke-dashoffset:0}}
.mtg-stream-enter{animation:mtg-stream-enter .34s cubic-bezier(.25,.46,.45,.94) both}
.mtg-stream-enter .mtg-report-stat-value,
.mtg-stream-enter .mtg-stat-value{animation:mtg-stream-number .36s cubic-bezier(.25,.46,.45,.94) .12s both}
.mtg-stream-enter .mtg-report-stat-card{animation:mtg-stream-enter .32s cubic-bezier(.25,.46,.45,.94) both}
.mtg-stream-enter .mtg-report-stat-card:nth-child(2){animation-delay:60ms}
.mtg-stream-enter .mtg-report-stat-card:nth-child(3){animation-delay:120ms}
.mtg-stream-enter .mtg-report-stat-card:nth-child(4){animation-delay:180ms}
.mtg-stream-enter .mtg-report-stat-card:nth-child(n+5){animation-delay:220ms}
.mtg-stream-enter .mtg-stat-cell{animation:mtg-stream-enter .28s cubic-bezier(.25,.46,.45,.94) both}
.mtg-stream-enter .mtg-stat-cell:nth-child(2){animation-delay:50ms}
.mtg-stream-enter .mtg-stat-cell:nth-child(3){animation-delay:100ms}
.mtg-stream-enter .mtg-stat-cell:nth-child(n+4){animation-delay:140ms}
.mtg-stream-enter .mtg-chart-mark{animation:mtg-stream-enter .3s cubic-bezier(.25,.46,.45,.94) both}
.mtg-stream-enter .mtg-chart-mark:nth-child(2){animation-delay:40ms}
.mtg-stream-enter .mtg-chart-mark:nth-child(3){animation-delay:80ms}
.mtg-stream-enter .mtg-chart-mark:nth-child(4){animation-delay:120ms}
.mtg-stream-enter .mtg-chart-mark:nth-child(5){animation-delay:160ms}
.mtg-stream-enter .mtg-chart-mark:nth-child(n+6){animation-delay:200ms}
.mtg-stream-enter .mtg-report-chart-svg[data-mtg-chart-type="bar"] .mtg-chart-mark rect[fill]:not([fill="none"]){transform-origin:bottom center;animation:mtg-stream-bar .44s cubic-bezier(.25,.46,.45,.94) both;animation-delay:inherit}
.mtg-stream-enter .mtg-report-chart-svg polyline[stroke]{stroke-dasharray:var(--mtg-dash-len,1000);animation:mtg-stream-line .7s cubic-bezier(.25,.46,.45,.94) .15s both}
.mtg-stream-enter .mtg-chart-legend{animation:mtg-stream-enter .28s cubic-bezier(.25,.46,.45,.94) .2s both}
.mtg-stream-enter .mtg-report-stat-change{animation:mtg-stream-number .28s cubic-bezier(.25,.46,.45,.94) .22s both}
.mtg-stream-enter .mtg-report-stat-spark{animation:mtg-stream-enter .4s cubic-bezier(.25,.46,.45,.94) .18s both}
@media(prefers-reduced-motion:reduce){[data-mtg-stream-slot][data-mtg-stream-filled]{animation:none!important;opacity:1;transform:none}.mtg-stream-enter,.mtg-stream-enter *{animation:none!important}}
`;

const STREAM_SHADOW_BASE_CSS = `
:host{display:block;width:100%;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111827}
:host *,:host *::before,:host *::after{box-sizing:border-box}
:host img,:host svg,:host canvas,:host video{max-width:100%;height:auto}
:host label{display:block;margin:0 0 4px;color:#475467;font:600 12px/1.25 Inter,ui-sans-serif,system-ui,sans-serif}
:host :where(input,select,textarea){max-width:100%;border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#111827;padding:7px 9px;font:500 13px/1.3 Inter,ui-sans-serif,system-ui,sans-serif;box-shadow:0 1px 2px rgba(16,24,40,.04)}
:host :where(input,select,textarea):focus{outline:2px solid rgba(37,99,235,.2);border-color:#2563eb}
:host :where(button){appearance:none;border:1px solid #1d4ed8;border-radius:8px;background:#2563eb;color:#fff;padding:8px 12px;font:800 13px/1.2 Inter,ui-sans-serif,system-ui,sans-serif;cursor:pointer;box-shadow:0 1px 2px rgba(16,24,40,.08)}
:host :where(button):hover{background:#1d4ed8}
:host table:not([class]){width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
:host th:not([class]),:host td:not([class]){padding:10px 12px;border-bottom:1px solid #eef2f7;text-align:left}
:host th:not([class]){color:#667085;font:700 11px/1.2 Inter,ui-sans-serif,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.08em}
`;

function adaptCssForStreamShadowDom(css: string): string {
  return css
    .replace(/:root/g, ":host")
    .replace(/(?:html\s*,\s*body|body\s*,\s*html)\s*\{/g, ":host{")
    .replace(/(?<![.\-\w])body\s*\{/g, ":host{");
}

function injectStreamTransitionStyle(root: Document | ShadowRoot): void {
  if (root.querySelector("style[data-mtg-stream-transitions]")) return;
  const doc = isDocumentRoot(root) ? root : root.ownerDocument;
  const style = doc.createElement("style");
  style.setAttribute("data-mtg-stream-transitions", "true");
  style.textContent = STREAM_TRANSITION_CSS;
  if (isShadowRoot(root)) {
    root.insertBefore(style, root.firstChild);
    return;
  }
  (root.head ?? root.documentElement ?? root.body)?.appendChild(style);
}

function injectStreamShadowBaseStyle(root: ShadowRoot): void {
  if (root.querySelector("style[data-mtg-stream-shadow-base]")) return;
  const style = root.ownerDocument.createElement("style");
  style.setAttribute("data-mtg-stream-shadow-base", "true");
  style.textContent = STREAM_SHADOW_BASE_CSS;
  root.insertBefore(style, root.firstChild);
}

function normalizeStreamShadowStyles(root: ShadowRoot): void {
  for (const style of Array.from(root.querySelectorAll("style"))) {
    style.textContent = adaptCssForStreamShadowDom(style.textContent ?? "");
  }
}

function runStreamShadowScripts(root: ShadowRoot, host: HTMLElement): void {
  for (const script of Array.from(root.querySelectorAll("script"))) {
    const src = script.getAttribute("src");
    if (src) {
      const escapedSrc = escapeCssSelector(src, host.ownerDocument);
      if (!host.ownerDocument.querySelector(`script[src="${escapedSrc}"]`)) {
        const external = host.ownerDocument.createElement("script");
        external.src = src;
        external.setAttribute("data-mtg-stream-external", "true");
        host.ownerDocument.head.appendChild(external);
      }
      script.remove();
      continue;
    }

    const code = script.textContent ?? "";
    script.remove();
    if (!code.trim()) continue;
    try {
      new Function("shadowRoot", "host", code)(root, host);
    } catch {
      // Stream render scripts are best-effort; host apps can observe failures
      // through their capability bridge or browser console if needed.
    }
  }
}

function runStreamInlineScripts(root: HTMLElement): void {
  for (const script of Array.from(root.querySelectorAll("script"))) {
    const executable = root.ownerDocument.createElement("script");
    executable.async = false;
    for (const attr of Array.from(script.attributes)) {
      executable.setAttribute(attr.name, attr.value);
    }
    executable.textContent = script.textContent ?? "";
    script.replaceWith(executable);
  }
}

function getStreamShadowRoot(target: HTMLElement): ShadowRoot {
  return target.shadowRoot ?? target.attachShadow({ mode: "open" });
}

function getStreamBridgeRoot(
  target: HTMLElement | HTMLIFrameElement,
  mountMode: "inline" | "shadow" = "inline",
): Document | ShadowRoot | HTMLElement | undefined {
  if (isIframeTarget(target)) {
    return target.contentDocument ?? target.ownerDocument;
  }
  if (mountMode === "shadow") return getStreamShadowRoot(target);
  return target;
}

function installStreamCapabilityBridge(
  target: HTMLElement | HTMLIFrameElement,
  mountMode: "inline" | "shadow" = "inline",
  options: Pick<
    MontageStreamSurfaceOptions,
    "adapter" | "context" | "onCapabilityError" | "onCapabilityEvent"
  >,
): () => void {
  if (!options.adapter) return () => {};
  return installCapabilityBridge({
    mode: "sdk",
    adapter: options.adapter,
    context: options.context,
    root: getStreamBridgeRoot(target, mountMode),
    onCapabilityError: options.onCapabilityError,
    onCapabilityEvent: options.onCapabilityEvent,
  });
}

const STREAM_CAPABILITY_ALIAS_SELECTOR =
  "button,[role='button'],input[type='button'],input[type='submit']";
const STREAM_NATIVE_CAPABILITY_SELECTOR =
  "[data-aot-capability],[data-proof-capability],[data-mtg-capability],[data-montage-capability]";
const STREAM_HOST_FALLBACK_SELECTOR = "[data-nexus-capability-fallback='true']";

type StreamAotHost = typeof globalThis & {
  MontageAOT?: {
    invoke?: (args: {
      name: string;
      source?: string;
      effect: MontageCapabilityEffect;
      args?: unknown;
      context?: unknown;
    }) => Promise<unknown> | unknown;
  };
};

type WindowWithMontageAOT = Window & StreamAotHost;

function streamCapabilityArgNeedsValue(value: unknown): boolean {
  return (
    value == null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function streamCapabilityFormArgKey(key: string): string {
  const stripped = key.replace(/^form(?=[A-Z_:-])/, "").trim();
  if (!stripped) return "";
  return stripped.charAt(0).toLowerCase() + stripped.slice(1);
}

function streamCapabilityFieldValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): unknown {
  const InputCtor = element.ownerDocument.defaultView?.HTMLInputElement;
  const input =
    InputCtor && element instanceof InputCtor
      ? (element as HTMLInputElement)
      : null;
  if (input?.type === "checkbox") return input.checked;
  if (input?.type === "number" || input?.type === "range") {
    const numeric = Number(input.value);
    return Number.isFinite(numeric) ? numeric : input.value;
  }
  return element.value;
}

function assignStreamCapabilityFormArg(
  args: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  if (!key || streamCapabilityArgNeedsValue(value)) return;
  args[key] = value;
}

function collectStreamFrameFormArgs(
  frameDocument: Document | null,
): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  if (!frameDocument) return args;
  const fields = frameDocument.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >("input, textarea, select");
  for (const field of Array.from(fields)) {
    if (field.disabled) continue;
    const InputCtor = frameDocument.defaultView?.HTMLInputElement;
    if (InputCtor && field instanceof InputCtor && field.type === "hidden")
      continue;
    const style = frameDocument.defaultView?.getComputedStyle(field);
    if (style && (style.display === "none" || style.visibility === "hidden"))
      continue;
    const key = [
      field.getAttribute("data-bind"),
      field.getAttribute("data-aot-action"),
      field.getAttribute("data-mtg-action"),
      field.getAttribute("aria-label"),
      field.getAttribute("placeholder"),
      field.getAttribute("name"),
      field.id,
      field.closest("label")?.textContent,
    ].find((entry) => entry && entry.trim());
    if (!key || /^search$/i.test(key.trim()) || /filter$/i.test(key)) continue;
    const argKey = streamCapabilityFormArgKey(key);
    if (!argKey) continue;
    const value = streamCapabilityFieldValue(field);
    assignStreamCapabilityFormArg(args, argKey, value);
    if (/^form/.test(key)) assignStreamCapabilityFormArg(args, key, value);
    if (/(note|comment)/i.test(argKey))
      assignStreamCapabilityFormArg(args, "note", value);
    if (/stage/i.test(argKey))
      assignStreamCapabilityFormArg(args, "stage", value);
    if (/threshold/i.test(argKey))
      assignStreamCapabilityFormArg(args, "threshold", value);
  }
  return args;
}

function mergeStreamFrameFormArgsObject(
  args: Record<string, unknown>,
  formArgs: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...args };
  for (const key of Object.keys(next)) {
    if (
      streamCapabilityArgNeedsValue(next[key]) &&
      !streamCapabilityArgNeedsValue(formArgs[key])
    ) {
      next[key] = formArgs[key];
    }
  }
  return next;
}

function mergeStreamFrameFormArgs(
  call: unknown,
  frameDocument: Document | null,
): unknown {
  if (!call || typeof call !== "object" || Array.isArray(call)) return call;
  const record = call as Record<string, unknown>;
  const requestArgs = record.args;
  if (!requestArgs || typeof requestArgs !== "object") return call;
  const formArgs = collectStreamFrameFormArgs(frameDocument);
  if (Object.keys(formArgs).length === 0) return call;
  if (
    Array.isArray(requestArgs) &&
    requestArgs.length === 1 &&
    requestArgs[0] &&
    typeof requestArgs[0] === "object" &&
    !Array.isArray(requestArgs[0])
  ) {
    return {
      ...record,
      args: [
        mergeStreamFrameFormArgsObject(
          requestArgs[0] as Record<string, unknown>,
          formArgs,
        ),
      ],
    };
  }
  if (!Array.isArray(requestArgs)) {
    return {
      ...record,
      args: mergeStreamFrameFormArgsObject(
        requestArgs as Record<string, unknown>,
        formArgs,
      ),
    };
  }
  return call;
}

function collectStreamFrameElements(
  target: HTMLElement | HTMLIFrameElement,
  mountMode: "inline" | "shadow" = "inline",
): HTMLIFrameElement[] {
  const frames: HTMLIFrameElement[] = [];
  if (isIframeTarget(target)) frames.push(target);
  const root = getStreamRoot(target, mountMode);
  if (root && "querySelectorAll" in root) {
    frames.push(
      ...Array.from(root.querySelectorAll<HTMLIFrameElement>("iframe")),
    );
  }
  return [...new Set(frames)];
}

function installStreamFrameCapabilityBridge(
  target: HTMLElement | HTMLIFrameElement,
  mountMode: "inline" | "shadow" = "inline",
): () => void {
  const host = (globalThis as StreamAotHost).MontageAOT;
  if (typeof host?.invoke !== "function") return () => {};

  const cleanups: Array<() => void> = [];
  for (const frame of collectStreamFrameElements(target, mountMode)) {
    let previousHost: WindowWithMontageAOT["MontageAOT"];
    let installed = false;

    const installIntoFrame = () => {
      try {
        const frameWindow = frame.contentWindow as WindowWithMontageAOT | null;
        if (!frameWindow) return;
        if (!installed) {
          previousHost = frameWindow.MontageAOT;
          installed = true;
        }
        frameWindow.MontageAOT = {
          ...(frameWindow.MontageAOT ?? {}),
          ...host,
          invoke: (call) =>
            host.invoke?.(
              mergeStreamFrameFormArgs(
                call,
                frame.contentDocument,
              ) as Parameters<NonNullable<typeof host.invoke>>[0],
            ),
        };
      } catch {
        // Cross-origin frames are outside the SDK bridge boundary.
      }
    };

    installIntoFrame();
    frame.addEventListener("load", installIntoFrame);
    cleanups.push(() => {
      frame.removeEventListener("load", installIntoFrame);
      try {
        const frameWindow = frame.contentWindow as WindowWithMontageAOT | null;
        if (!frameWindow || !installed) return;
        if (previousHost) {
          frameWindow.MontageAOT = previousHost;
        } else {
          delete frameWindow.MontageAOT;
        }
      } catch {
        // Ignore inaccessible frame cleanup.
      }
    });
  }

  return () => {
    for (const cleanup of cleanups.reverse()) cleanup();
  };
}

function normalizeCapabilityAliasLabel(
  value: string | null | undefined,
): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function isElementLike(value: unknown): value is Element {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as Element).matches === "function" &&
    typeof (value as Element).closest === "function",
  );
}

function findCapabilityAliasElement(event: Event): HTMLElement | null {
  const path =
    typeof event.composedPath === "function" ? event.composedPath() : [];
  for (const item of path) {
    if (isElementLike(item) && item.matches(STREAM_CAPABILITY_ALIAS_SELECTOR)) {
      return item as HTMLElement;
    }
  }

  const target = event.target;
  if (!isElementLike(target)) return null;
  return target.closest(STREAM_CAPABILITY_ALIAS_SELECTOR) as HTMLElement | null;
}

function capabilityAliasElementLabels(element: HTMLElement): string[] {
  const values = [
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    typeof (element as { value?: unknown }).value === "string"
      ? String((element as { value?: unknown }).value)
      : undefined,
    element.textContent,
  ];
  const labels: string[] = [];
  for (const value of values) {
    const label = normalizeCapabilityAliasLabel(value);
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels;
}

function matchesCapabilityAliasLabel(
  alias: MontageStreamCapabilityAlias,
  labels: string[],
): boolean {
  for (const candidate of labels) {
    for (const label of alias.labels) {
      if (typeof label === "string") {
        if (
          candidate.toLocaleLowerCase() ===
          normalizeCapabilityAliasLabel(label).toLocaleLowerCase()
        ) {
          return true;
        }
        continue;
      }

      label.lastIndex = 0;
      if (label.test(candidate)) return true;
    }
  }
  return false;
}

function resolveCapabilityAliasArgs(
  alias: MontageStreamCapabilityAlias,
  context: MontageStreamCapabilityAliasContext,
): unknown {
  if (typeof alias.args === "function") return alias.args(context);
  return alias.args;
}

function installStreamCapabilityAliasBridge(
  target: HTMLElement | HTMLIFrameElement,
  mountMode: "inline" | "shadow" = "inline",
  options: Pick<
    MontageStreamSurfaceOptions,
    "adapter" | "capabilityAliases" | "context"
  >,
): () => void {
  const aliases = options.capabilityAliases?.filter(
    (alias) => alias.name.trim() && alias.labels.length > 0,
  );
  if (!options.adapter || !aliases?.length) return () => {};

  const root = getStreamBridgeRoot(target, mountMode);
  if (!root || typeof root.addEventListener !== "function") return () => {};

  const makeListener =
    (listenerRoot: Document | ShadowRoot | HTMLElement) => (event: Event) => {
      if ((event as MouseEvent).defaultPrevented) return;
      const element = findCapabilityAliasElement(event);
      if (!element) return;
      if (element.closest(STREAM_NATIVE_CAPABILITY_SELECTOR)) return;
      if (element.closest(STREAM_HOST_FALLBACK_SELECTOR)) return;

      const labels = capabilityAliasElementLabels(element);
      const alias = aliases.find((entry) =>
        matchesCapabilityAliasLabel(entry, labels),
      );
      if (!alias) return;

      const host = (globalThis as StreamAotHost).MontageAOT;
      if (typeof host?.invoke !== "function") return;

      event.preventDefault();
      event.stopPropagation();
      const args = resolveCapabilityAliasArgs(alias, {
        element,
        event: event as MouseEvent,
        root: listenerRoot,
        target,
      });

      void Promise.resolve(
        host.invoke({
          name: alias.name,
          source: alias.source ?? alias.name,
          effect: alias.effect ?? "effect",
          ...(args !== undefined ? { args } : {}),
          context: options.context,
        }),
      ).catch(() => undefined);
    };

  const cleanups: Array<() => void> = [];
  const attachedAliasRoots = new WeakSet<Document | ShadowRoot | HTMLElement>();
  const attach = (listenerRoot: Document | ShadowRoot | HTMLElement) => {
    if (typeof listenerRoot.addEventListener !== "function") return;
    if (attachedAliasRoots.has(listenerRoot)) return;
    attachedAliasRoots.add(listenerRoot);
    const listener = makeListener(listenerRoot);
    listenerRoot.addEventListener("click", listener, true);
    cleanups.push(() =>
      listenerRoot.removeEventListener("click", listener, true),
    );
    if (!("querySelectorAll" in listenerRoot)) return;
    for (const element of Array.from(
      listenerRoot.querySelectorAll<HTMLElement>(
        STREAM_CAPABILITY_ALIAS_SELECTOR,
      ),
    )) {
      const labels = capabilityAliasElementLabels(element);
      if (
        !aliases.some((entry) => matchesCapabilityAliasLabel(entry, labels))
      ) {
        continue;
      }
      element.addEventListener("click", listener, true);
      cleanups.push(() => element.removeEventListener("click", listener, true));
    }
  };

  attach(root);
  for (const frame of collectStreamFrameElements(target, mountMode)) {
    const attachFrameDocument = () => {
      try {
        if (frame.contentDocument) attach(frame.contentDocument);
      } catch {
        // Cross-origin frames are outside the SDK bridge boundary.
      }
    };
    attachFrameDocument();
    frame.addEventListener("load", attachFrameDocument);
    cleanups.push(() => frame.removeEventListener("load", attachFrameDocument));
  }

  return () => {
    for (const cleanup of cleanups.reverse()) cleanup();
  };
}

function mountStreamHtml(
  target: HTMLElement | HTMLIFrameElement,
  html: string,
  isDone = false,
  mountMode: "inline" | "shadow" = "inline",
  executeScripts = true,
): () => void {
  if (isIframeTarget(target)) {
    writeIframeDocument(target, html);
    const iframeDoc = target.contentDocument;
    if (iframeDoc) {
      injectStreamTransitionStyle(iframeDoc);
      if (!isDone && iframeDoc.body) {
        iframeDoc.body.setAttribute("data-mtg-streaming", "true");
      }
    }
    return () => {
      target.srcdoc = "";
      const doc = target.contentDocument;
      if (doc) {
        doc.open();
        doc.write("");
        doc.close();
      }
    };
  }

  if (mountMode === "shadow") {
    const root = getStreamShadowRoot(target);
    const fragment = htmlToFragment(target.ownerDocument, html);
    root.replaceChildren(fragment);
    normalizeStreamShadowStyles(root);
    injectStreamTransitionStyle(root);
    injectStreamShadowBaseStyle(root);
    const rootElement = root.firstElementChild as HTMLElement | null;
    if (!isDone) {
      target.setAttribute("data-mtg-streaming", "true");
      rootElement?.setAttribute("data-mtg-streaming", "true");
    } else {
      target.removeAttribute("data-mtg-streaming");
      rootElement?.removeAttribute("data-mtg-streaming");
    }
    if (executeScripts) runStreamShadowScripts(root, target);
    else stripInertStreamScripts(root);
    return () => root.replaceChildren();
  }

  const fragment = htmlToFragment(target.ownerDocument, html);
  target.replaceChildren(fragment);
  if (!isDone) {
    target.setAttribute("data-mtg-streaming", "true");
  } else {
    target.removeAttribute("data-mtg-streaming");
  }
  injectStreamTransitionStyle(target.ownerDocument);
  if (executeScripts) runStreamInlineScripts(target);
  else stripInertStreamScripts(target);
  return () => target.replaceChildren();
}

/**
 * In a script-free preview the markup is mounted via innerHTML, so any inline
 * <script> is already inert (innerHTML never executes scripts). We still remove
 * them so a later host re-render can't accidentally re-run partial/duplicate JS.
 */
function stripInertStreamScripts(root: ParentNode): void {
  for (const script of Array.from(root.querySelectorAll("script"))) {
    script.remove();
  }
}


function getStreamRoot(
  target: HTMLElement | HTMLIFrameElement,
  mountMode: "inline" | "shadow" = "inline",
): HTMLElement | ShadowRoot | null {
  if (isIframeTarget(target)) {
    return target.contentDocument?.body ?? null;
  }
  if (mountMode === "shadow") return getStreamShadowRoot(target);
  return target;
}

function findStreamSlot(root: ParentNode, slot: string): HTMLElement | null {
  for (const element of Array.from(
    root.querySelectorAll<HTMLElement>("[data-mtg-stream-slot]"),
  )) {
    if (element.getAttribute("data-mtg-stream-slot") === slot) return element;
  }
  return null;
}

/**
 * Slots can arrive in compile order, not layout order (a later section may
 * finish before an earlier one). Server placeholders normally fix position, but
 * when a slot has no placeholder we must still insert it at its ordinal spot
 * instead of appending — otherwise the streamed preview reorders itself when the
 * final artifact mounts. Names look like `section-3`; the trailing integer is
 * the ordinal. Non-numbered slots (e.g. `html-app`) sort last, in arrival order.
 */
function parseSlotOrdinal(slot: string): number {
  const match = slot.match(/(\d+)\s*$/);
  return match ? Number.parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
}

function insertStreamSlotInOrder(
  container: ParentNode,
  slotElement: HTMLElement,
  slot: string,
): void {
  const ordinal = parseSlotOrdinal(slot);
  if (!Number.isFinite(ordinal)) {
    container.appendChild(slotElement);
    return;
  }
  const reference = Array.from(container.children).find((sibling) => {
    const siblingSlot = sibling.getAttribute("data-mtg-stream-slot");
    return (
      siblingSlot !== null && parseSlotOrdinal(siblingSlot) > ordinal
    );
  });
  if (reference) container.insertBefore(slotElement, reference);
  else container.appendChild(slotElement);
}

function patchStreamSlot(
  target: HTMLElement | HTMLIFrameElement,
  slot: string,
  html: string,
  styles?: string,
  stylesheets?: string[],
  mountMode: "inline" | "shadow" = "inline",
  executeScripts = true,
): void {
  if (!slot.trim()) return;
  const root = getStreamRoot(target, mountMode);
  if (!root) return;

  const ownerDocument = root.ownerDocument;
  let slotElement = findStreamSlot(root, slot);
  if (!slotElement) {
    slotElement = ownerDocument.createElement("section");
    slotElement.setAttribute("data-mtg-stream-slot", slot);
    const container =
      root.querySelector<HTMLElement>("[data-mtg-stream-slots]") ??
      root.querySelector<HTMLElement>("#mtg-streaming-sections") ??
      root;
    insertStreamSlotInOrder(container, slotElement, slot);
  }

  if (styles) {
    let styleEl = root.querySelector<HTMLStyleElement>(
      `style[data-mtg-slot-style="${escapeCssSelector(slot, ownerDocument)}"]`,
    );
    if (!styleEl) {
      styleEl = ownerDocument.createElement("style");
      styleEl.setAttribute("data-mtg-slot-style", slot);
      root.insertBefore(styleEl, root.firstChild);
    }
    if (styleEl.textContent !== styles) styleEl.textContent = styles;
    if (mountMode === "shadow") {
      styleEl.textContent = adaptCssForStreamShadowDom(
        styleEl.textContent ?? "",
      );
    }
  }
  if (stylesheets) {
    for (const href of stylesheets) {
      if (!root.querySelector(`link[href="${href}"]`)) {
        const link = ownerDocument.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        root.insertBefore(link, root.firstChild);
      }
    }
  }

  // d3/canvas apps stream as a nested <iframe srcdoc> whose scripts execute
  // inside that iframe — already isolated from the host window — so we render
  // them incrementally (title + controls + viz appear as they arrive). The
  // `executeScripts` guard only gates host-window execution of inline/shadow
  // declarative slots below; the nested-iframe path is unaffected.
  const allIframes = Array.from(
    slotElement.querySelectorAll<HTMLIFrameElement>("iframe[srcdoc]"),
  );
  const existingIframe =
    allIframes.find((f) => f.hasAttribute("data-mtg-active")) ??
    allIframes[allIframes.length - 1] ??
    null;
  const fragment = htmlToFragment(ownerDocument, html);
  const incomingIframe =
    fragment.querySelector<HTMLIFrameElement>("iframe[srcdoc]");

  if (existingIframe && incomingIframe) {
    const nextSrcdoc = incomingIframe.getAttribute("srcdoc") ?? "";
    const prevLen =
      (existingIframe as HTMLIFrameElement & { _mtgSrcdocLen?: number })
        ._mtgSrcdocLen ?? 0;
    const isFinal = nextSrcdoc.length > 0 && nextSrcdoc.length - prevLen < 200;
    if (!isFinal && nextSrcdoc.length - prevLen < 400 && prevLen > 0) {
      return;
    }
    (
      existingIframe as HTMLIFrameElement & { _mtgSrcdocLen?: number }
    )._mtgSrcdocLen = nextSrcdoc.length;
    const doc = existingIframe.contentDocument;
    if (doc && doc.body) {
      const parserCtor =
        ownerDocument.defaultView?.DOMParser ?? globalThis.DOMParser;
      const incoming = new parserCtor().parseFromString(
        nextSrcdoc,
        "text/html",
      );
      for (const style of Array.from(incoming.head.querySelectorAll("style"))) {
        const id = style.id || style.getAttribute("data-id");
        const existing = id ? doc.head.querySelector(`style#${id}`) : null;
        if (existing) {
          existing.textContent = style.textContent;
        } else {
          const clone = doc.importNode(style, true);
          if (!id)
            clone.setAttribute(
              "data-id",
              `mtg-injected-${doc.head.querySelectorAll("style").length}`,
            );
          doc.head.appendChild(clone);
        }
      }
      const incomingScripts: { code: string; src: string | null }[] = [];
      for (const s of Array.from(incoming.querySelectorAll("script"))) {
        incomingScripts.push({
          code: s.textContent ?? "",
          src: s.getAttribute("src"),
        });
        s.remove();
      }

      const incomingContent = incoming.getElementById("mtg-stream-content");
      const existingContent = doc.getElementById("mtg-stream-content");
      if (incomingContent && existingContent) {
        existingContent.innerHTML = incomingContent.innerHTML;
      } else {
        const spinner = doc.querySelector(".mtg-stream-spinner");
        doc.body.innerHTML = incoming.body.innerHTML;
        if (spinner && !doc.querySelector(".mtg-stream-spinner")) {
          doc.body.appendChild(spinner);
        }
      }

      for (const old of Array.from(
        doc.querySelectorAll("script[data-mtg-stream-injected]"),
      )) {
        old.remove();
      }
      for (const entry of incomingScripts) {
        const el = doc.createElement("script");
        el.setAttribute("data-mtg-stream-injected", "true");
        if (entry.src) {
          el.src = entry.src;
        } else {
          el.textContent = entry.code;
        }
        doc.body.appendChild(el);
      }
      if (!doc.querySelector(".mtg-stream-spinner")) {
        const spinner = doc.createElement("div");
        spinner.className = "mtg-stream-spinner";
        doc.body.appendChild(spinner);
      }
    } else {
      existingIframe.srcdoc = nextSrcdoc;
    }
  } else {
    slotElement.replaceChildren(fragment);
    if (!executeScripts) {
      stripInertStreamScripts(slotElement);
    } else if (mountMode === "shadow" && !isIframeTarget(target)) {
      const root = getStreamShadowRoot(target);
      normalizeStreamShadowStyles(root);
      injectStreamShadowBaseStyle(root);
      runStreamShadowScripts(root, target);
    } else if (!isIframeTarget(target)) {
      runStreamInlineScripts(slotElement);
    }
    const newIframe =
      slotElement.querySelector<HTMLIFrameElement>("iframe[srcdoc]");
    if (newIframe) {
      newIframe.style.opacity = "0";
      newIframe.addEventListener(
        "load",
        () => {
          newIframe.style.transition = "opacity 0.4s ease";
          newIframe.style.opacity = "1";
        },
        { once: true },
      );
    }
  }
  slotElement.setAttribute("aria-busy", "false");

  const alreadyFilled = slotElement.hasAttribute("data-mtg-stream-filled");

  if (!alreadyFilled) {
    let delay = 0;
    for (const child of Array.from(slotElement.children)) {
      const el = child as HTMLElement;
      if (el.nodeType === 1 && el.tagName !== "STYLE") {
        el.classList.add("mtg-stream-enter");
        el.style.animationDelay = `${delay}ms`;
        delay += 60;
      }
    }
    slotElement.setAttribute("data-mtg-stream-filled", "true");
  }
}

function createGenerateBody(
  input: MontageGenerateInput,
  config: MontageToolsConfig,
  options: { streaming?: boolean; output?: "html" | "fragment" },
): Record<string, unknown> {
  const designSystem = mergeDesignSystem(
    config.defaults?.designSystem,
    input.designSystem,
  );

  const body: Record<string, unknown> = {
    dataInfo: input.dataInfo,
    interactive: input.interactive ?? false,
    requestId: resolveRequestId(input.requestId),
  };
  if (input.prompt !== undefined) {
    body.prompt = input.prompt;
  } else if (input.input !== undefined) {
    body.input = input.input;
  }
  if (input.zeroed !== undefined) body.zeroed = input.zeroed;
  if (input.title) body.title = input.title;
  if (input.data !== undefined) body.data = input.data;
  if (input.hosted !== undefined) body.hosted = input.hosted;
  if (input.strictData !== undefined) body.strictData = input.strictData;
  if (input.requiredFields) body.requiredFields = input.requiredFields;
  if (input.requiredCapabilities)
    body.requiredCapabilities = input.requiredCapabilities;
  if (options.streaming) body.streaming = true;
  if (options.output) body.output = options.output;
  if (designSystem) body.designSystem = designSystem;
  if (config.defaults?.renderSurface) {
    body.renderSurface = config.defaults.renderSurface;
  }
  if (input.cache) {
    body.cache = input.cache;
  }
  if (input.adapter) {
    body.adapterManifest = input.adapter.getCapabilityManifest();
  }
  if (input.artifactId) {
    body.artifactId = input.artifactId;
  }
  if (input.includeHtml) {
    body.includeHtml = true;
  }
  return body;
}

export async function readMontageSseResponse<
  TEvent = MontageGenerateStreamEvent,
>(
  response: Response,
  onEvent: (event: TEvent, rawChunk: string) => void | Promise<void>,
): Promise<void> {
  if (!response.body) {
    throw new MontageApiError(
      "invalid_response",
      response.status,
      "Montage API streaming response did not include a body.",
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flushBlock = async (block: string, rawChunk: string) => {
    const line = block.split("\n").find((entry) => entry.startsWith("data: "));
    if (!line) return;
    let event: TEvent;
    try {
      event = JSON.parse(line.slice(6)) as TEvent;
    } catch {
      // Ignore malformed/partial SSE payloads.
      return;
    }
    await onEvent(event, rawChunk);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const rawChunk = decoder.decode(value, { stream: true });
    buffer += rawChunk;
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) await flushBlock(block, rawChunk);
  }

  const tail = decoder.decode();
  if (tail) buffer += tail;
  if (buffer.trim()) await flushBlock(buffer, tail);
}

function getStreamPaintWindow(
  target: HTMLElement | HTMLIFrameElement,
): Window | null {
  if (isIframeTarget(target)) {
    return target.contentWindow;
  }
  return target.ownerDocument.defaultView;
}

function waitForAnimationFrame(
  target: HTMLElement | HTMLIFrameElement,
): Promise<void> {
  const view = getStreamPaintWindow(target);
  if (!view?.requestAnimationFrame) return Promise.resolve();
  return new Promise((resolve) => {
    view.requestAnimationFrame(() => resolve());
  });
}

async function waitForStreamSlotPaint(
  target: HTMLElement | HTMLIFrameElement,
): Promise<void> {
  const view = getStreamPaintWindow(target);
  if (!view?.requestAnimationFrame) return;

  await waitForAnimationFrame(target);
  await waitForAnimationFrame(target);
  await new Promise<void>((resolve) => {
    view.setTimeout(resolve, STREAM_SLOT_PAINT_SETTLE_MS);
  });
}

export function createMontageStreamSurface(
  target: HTMLElement | HTMLIFrameElement,
  options: MontageStreamSurfaceOptions = {},
): MontageStreamSurface {
  let cleanupMount: () => void = () => {};
  let cleanupBridge: (() => void) | null = null;
  let cleanupFrameBridge: (() => void) | null = null;
  let cleanupAliases: (() => void) | null = null;
  let hasPendingSlotPaint = false;
  const mountMode = isIframeTarget(target)
    ? "inline"
    : (options.mountMode ?? "inline");
  const executeScripts = options.previewScripts !== false;

  const ensureBridge = () => {
    if (cleanupBridge || !options.adapter) return;
    cleanupBridge = installStreamCapabilityBridge(target, mountMode, options);
  };

  const refreshBridge = () => {
    cleanupBridge?.();
    cleanupBridge = null;
    ensureBridge();
  };

  const refreshFrameBridge = () => {
    cleanupFrameBridge?.();
    cleanupFrameBridge = null;
    if (!options.adapter) return;
    cleanupFrameBridge = installStreamFrameCapabilityBridge(target, mountMode);
  };

  const refreshAliases = () => {
    cleanupAliases?.();
    cleanupAliases = null;
    if (!options.adapter || !options.capabilityAliases?.length) return;
    cleanupAliases = installStreamCapabilityAliasBridge(
      target,
      mountMode,
      options,
    );
  };

  const cleanup = () => {
    cleanupMount();
    cleanupBridge?.();
    cleanupFrameBridge?.();
    cleanupAliases?.();
    cleanupMount = () => {};
    cleanupBridge = null;
    cleanupFrameBridge = null;
    cleanupAliases = null;
    hasPendingSlotPaint = false;
  };

  return {
    async applyEvent(event: MontageGenerateStreamEvent): Promise<void> {
      const normalized = normalizeMontageStreamEvent(event);
      if (!normalized) return;

      if (normalized.type === "shell") {
        cleanupMount();
        ensureBridge();
        cleanupMount = mountStreamHtml(
          target,
          normalized.html,
          false,
          mountMode,
          executeScripts,
        );
        refreshBridge();
        refreshFrameBridge();
        refreshAliases();
        hasPendingSlotPaint = false;
        return;
      }

      if (normalized.type === "slot") {
        ensureBridge();
        patchStreamSlot(
          target,
          normalized.slot,
          normalized.html,
          (normalized as Record<string, unknown>).styles as string | undefined,
          (normalized as Record<string, unknown>).stylesheets as
            | string[]
            | undefined,
          mountMode,
          executeScripts,
        );
        refreshBridge();
        refreshFrameBridge();
        refreshAliases();
        hasPendingSlotPaint = true;
        return;
      }

      if (normalized.type === "done" || normalized.type === "artifact") {
        if (hasPendingSlotPaint) {
          await waitForStreamSlotPaint(target);
          hasPendingSlotPaint = false;
        }
        const finalHtml =
          htmlFromFinalStreamParts(normalized) ?? normalized.html;
        if (typeof finalHtml !== "string") return;
        cleanupMount();
        ensureBridge();
        cleanupMount = mountStreamHtml(
          target,
          finalHtml,
          true,
          mountMode,
          executeScripts,
        );
        refreshBridge();
        refreshFrameBridge();
        refreshAliases();
        return;
      }

      if (normalized.type === "error") {
        cleanup();
      }
    },
    cleanup,
  };
}

async function readApiError(response: Response): Promise<MontageApiError> {
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

  const errorObj = errorBody.error ?? errorBody;
  return new MontageApiError(
    errorObj.code ?? "api_error",
    response.status,
    errorObj.message ??
      `Montage API returned ${response.status} ${response.statusText}`,
  );
}

async function requestAdapterConfig(
  apiUrl: string,
  apiKey: string,
  provider: string,
  adapterConfig: Record<string, string>,
  config?: MontageToolsConfig,
): Promise<void> {
  const response = await fetch(
    `${apiUrl}/v1/adapters/${encodeURIComponent(provider)}`,
    {
      method: "PUT",
      headers: buildSdkRequestHeaders(apiKey, config, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(adapterConfig),
    },
  );
  if (!response.ok) throw await readApiError(response);
}

async function requestAdapterList(
  apiUrl: string,
  apiKey: string,
  config?: MontageToolsConfig,
): Promise<AdapterConfigSummary[]> {
  const response = await fetch(`${apiUrl}/v1/adapters`, {
    headers: buildSdkRequestHeaders(apiKey, config),
  });
  if (!response.ok) throw await readApiError(response);
  const body = (await response.json()) as { data?: AdapterConfigSummary[] };
  return body.data ?? [];
}

async function requestAdapterRemove(
  apiUrl: string,
  apiKey: string,
  provider: string,
  config?: MontageToolsConfig,
): Promise<void> {
  const response = await fetch(
    `${apiUrl}/v1/adapters/${encodeURIComponent(provider)}`,
    {
      method: "DELETE",
      headers: buildSdkRequestHeaders(apiKey, config),
    },
  );
  if (!response.ok) throw await readApiError(response);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function appendQuery(
  url: string,
  params: Record<string, string | number | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    query.set(key, String(value));
  }
  const serialized = query.toString();
  return serialized ? `${url}?${serialized}` : url;
}

async function requestJson<T>(
  apiUrl: string,
  apiKey: string,
  path: string,
  init: RequestInit = {},
  config?: MontageToolsConfig,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: buildSdkRequestHeaders(apiKey, config, {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(isRecord(init.headers) ? init.headers : {}),
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new MontageApiError(
      "network",
      0,
      `Montage API request failed: ${message}`,
    );
  }

  if (!response.ok) throw await readApiError(response);
  return (await response.json()) as T;
}

async function requestText(
  apiUrl: string,
  apiKey: string,
  path: string,
  init: RequestInit = {},
  config?: MontageToolsConfig,
): Promise<{ text: string; contentType: string }> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: buildSdkRequestHeaders(apiKey, config, {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(isRecord(init.headers) ? init.headers : {}),
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new MontageApiError(
      "network",
      0,
      `Montage API request failed: ${message}`,
    );
  }

  if (!response.ok) throw await readApiError(response);
  const headers = response.headers as Headers | undefined;
  return {
    text: await response.text(),
    contentType: headers?.get("Content-Type") ?? "",
  };
}

function buildSdkRequestHeaders(
  apiKey: string,
  config: Pick<MontageToolsConfig, "headers"> | undefined,
  headers: Record<string, string> = {},
): Record<string, string> {
  const configuredHeaders = { ...(config?.headers ?? {}) };
  for (const key of Object.keys(configuredHeaders)) {
    if (key.toLowerCase() === "authorization") delete configuredHeaders[key];
  }
  return {
    ...configuredHeaders,
    ...headers,
    Authorization: `Bearer ${apiKey}`,
  };
}

function capabilityManifestFromAdapter(
  adapter: MontageAdapter<MontageAgentDescriptor> | undefined,
): MontageCapabilityManifest | undefined {
  return adapter?.getCapabilityManifest();
}

function createArtifactBody(
  input: MontageCreateArtifactInput | MontagePatchArtifactInput,
  config: MontageToolsConfig,
  options: { operation: "create" | "patch" | "restyle" } = {
    operation: "create",
  },
): Record<string, unknown> {
  const designSystemInput = input.designSystem ?? input.context?.designSystem;
  const designSystem = mergeDesignSystem(
    config.defaults?.designSystem,
    designSystemInput,
  );
  const context: MontageArtifactContext = {
    ...(input.context ?? {}),
  };
  if ("artifactId" in input && input.artifactId && !context.artifactId) {
    context.artifactId = input.artifactId;
  }
  if (input.dataInfo !== undefined && context.dataInfo === undefined) {
    context.dataInfo = input.dataInfo;
  }
  if (input.data !== undefined && context.data === undefined) {
    context.data = input.data;
  }
  if (input.publicEnv !== undefined && context.publicEnv === undefined) {
    context.publicEnv = input.publicEnv;
  }
  if (input.providerEnv !== undefined && context.providerEnv === undefined) {
    context.providerEnv = input.providerEnv;
  }
  if (input.renderSurface && !context.renderSurface) {
    context.renderSurface = input.renderSurface;
  } else if (config.defaults?.renderSurface && !context.renderSurface) {
    context.renderSurface = config.defaults.renderSurface;
  }
  if (designSystem) {
    context.designSystem = designSystem;
  }
  const designSystemVersionId =
    input.designSystemVersionId ?? input.context?.designSystemVersionId;
  if (designSystemVersionId && !context.designSystemVersionId) {
    context.designSystemVersionId = designSystemVersionId;
  }

  const constraints: MontageArtifactConstraints = {
    ...(input.constraints ?? {}),
  };
  if (input.cache !== undefined && constraints.cache === undefined)
    constraints.cache = input.cache;
  if (input.hosted !== undefined && constraints.hosted === undefined)
    constraints.hosted = input.hosted;
  if (input.interactive !== undefined && constraints.interactive === undefined)
    constraints.interactive = input.interactive;
  if (input.zeroed !== undefined && constraints.zeroed === undefined)
    constraints.zeroed = input.zeroed;
  if (input.strictData !== undefined && constraints.strictData === undefined)
    constraints.strictData = input.strictData;
  if (
    input.requiredFields !== undefined &&
    constraints.requiredFields === undefined
  ) {
    constraints.requiredFields = input.requiredFields;
  }
  if (
    input.requiredCapabilities !== undefined &&
    constraints.requiredCapabilities === undefined
  ) {
    constraints.requiredCapabilities = input.requiredCapabilities;
  }

  const body: Record<string, unknown> = {
    requestId: resolveRequestId(input.requestId),
  };
  if (options.operation === "create") {
    if ("request" in input && input.request !== undefined) {
      body.request = input.request;
    } else if ("prompt" in input && input.prompt !== undefined) {
      body.prompt = input.prompt;
    } else if ("input" in input && input.input !== undefined) {
      body.input = input.input;
    }
  } else {
    body.instruction = "instruction" in input ? input.instruction : undefined;
  }
  if ("baseRevisionId" in input && input.baseRevisionId) {
    body.baseRevisionId = input.baseRevisionId;
  }
  if ("mode" in input && input.mode) {
    body.mode = input.mode;
  }
  if (input.title) body.title = input.title;
  if (input.backendType) body.backendType = input.backendType;
  if (designSystemVersionId) body.designSystemVersionId = designSystemVersionId;
  if (input.seed) body.seed = input.seed;
  if (Object.keys(context).length > 0) body.context = context;
  if (Object.keys(constraints).length > 0) body.constraints = constraints;

  const adapterManifest = capabilityManifestFromAdapter(input.adapter);
  if (adapterManifest) body.adapterManifest = adapterManifest;

  return body;
}

function assertArtifactId(artifactId: string, field = "artifactId"): string {
  const value = artifactId.trim();
  if (!value) {
    throw new MontageApiError(
      "invalid_request",
      400,
      `${field} must be a non-empty string.`,
    );
  }
  return encodeURIComponent(value);
}

function parseCreateArtifactResponse(
  body: unknown,
  status: number,
): MontageCreateArtifactResult {
  const data = isRecord(body) && isRecord(body.data) ? body.data : body;
  if (!isRecord(data)) {
    throw new MontageApiError(
      "invalid_response",
      status,
      "Montage artifact response did not include data.",
    );
  }
  const artifact = data.artifact;
  const generation = data.generation;
  const html = data.html;
  if (
    !isRecord(artifact) ||
    !isRecord(generation) ||
    typeof html !== "string"
  ) {
    throw new MontageApiError(
      "invalid_response",
      status,
      "Montage artifact response did not include artifact, generation, and HTML.",
    );
  }
  return data as unknown as MontageCreateArtifactResult;
}

function parseUpdateArtifactResponse(
  body: unknown,
  status: number,
): MontageUpdateArtifactResult {
  const data = isRecord(body) && isRecord(body.data) ? body.data : body;
  if (!isRecord(data) || !isRecord(data.artifact)) {
    throw new MontageApiError(
      "invalid_response",
      status,
      "Montage artifact update response did not include artifact.",
    );
  }
  return data as unknown as MontageUpdateArtifactResult;
}

function parseArtifactLifecycleResponse(
  body: unknown,
  status: number,
): MontageArtifactLifecycleResult {
  const data = isRecord(body) && isRecord(body.data) ? body.data : body;
  if (!isRecord(data) || !isRecord(data.artifact) || !isRecord(data.revision)) {
    throw new MontageApiError(
      "invalid_response",
      status,
      "Montage artifact lifecycle response did not include artifact and revision.",
    );
  }
  return data as unknown as MontageArtifactLifecycleResult;
}

function parseArtifactExportResponse(
  body: unknown,
  status: number,
): MontageArtifactExportBundle {
  const data = isRecord(body) && isRecord(body.data) ? body.data : body;
  if (
    !isRecord(data) ||
    !isRecord(data.artifact) ||
    !isRecord(data.revision) ||
    !isRecord(data.bundle)
  ) {
    throw new MontageApiError(
      "invalid_response",
      status,
      "Montage artifact export response did not include artifact, revision, and bundle.",
    );
  }
  return data as unknown as MontageArtifactExportBundle;
}

function parseArtifactArchiveExportResponse(
  body: unknown,
  status: number,
): MontageArtifactArchiveExport {
  const data = isRecord(body) && isRecord(body.data) ? body.data : body;
  if (
    !isRecord(data) ||
    !isRecord(data.artifact) ||
    !isRecord(data.revision) ||
    !isRecord(data.export) ||
    !Array.isArray(data.export.files)
  ) {
    throw new MontageApiError(
      "invalid_response",
      status,
      "Montage artifact archive export response did not include artifact, revision, and files.",
    );
  }
  return data as unknown as MontageArtifactArchiveExport;
}

async function requestCreateArtifact(
  apiUrl: string,
  apiKey: string,
  input: MontageCreateArtifactInput,
  config: MontageToolsConfig,
): Promise<MontageCreateArtifactResult> {
  const body = createArtifactBody(input, config);
  const responseBody = await requestJson<unknown>(
    apiUrl,
    apiKey,
    "/v1/artifacts",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    config,
  );
  return parseCreateArtifactResponse(responseBody, 200);
}

async function requestStreamCreateArtifact(
  apiUrl: string,
  apiKey: string,
  input: MontageCreateArtifactInput,
  config: MontageToolsConfig,
  onEvent: (
    event: MontageGenerateStreamEvent,
    rawChunk: string,
  ) => void | Promise<void>,
  options: { signal?: AbortSignal } = {},
): Promise<void> {
  const body = createArtifactBody(input, config);
  body.streaming = true;

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/v1/artifacts`, {
      method: "POST",
      headers: buildSdkRequestHeaders(apiKey, config, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (error) {
    if (options.signal?.aborted) {
      throw new MontageApiError(
        "aborted",
        0,
        "Montage artifact streaming request aborted.",
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new MontageApiError(
      "network",
      0,
      `Montage artifact streaming request failed: ${message}`,
    );
  }

  if (!response.ok) throw await readApiError(response);
  await readMontageSseResponse(response, onEvent);
}

async function requestUpdateArtifact(
  apiUrl: string,
  apiKey: string,
  artifactId: string,
  input: MontageUpdateArtifactInput,
  config?: MontageToolsConfig,
): Promise<MontageUpdateArtifactResult> {
  const responseBody = await requestJson<unknown>(
    apiUrl,
    apiKey,
    `/v1/artifacts/${assertArtifactId(artifactId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    config,
  );
  return parseUpdateArtifactResponse(responseBody, 200);
}

async function requestPatchArtifact(
  apiUrl: string,
  apiKey: string,
  artifactId: string,
  input: MontagePatchArtifactInput,
  config: MontageToolsConfig,
  operation: "patch" | "restyle",
): Promise<MontageCreateArtifactResult> {
  const body = createArtifactBody(input, config, { operation });
  const responseBody = await requestJson<unknown>(
    apiUrl,
    apiKey,
    `/v1/artifacts/${assertArtifactId(artifactId)}/${operation}`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    config,
  );
  return parseCreateArtifactResponse(responseBody, 200);
}

function requestArtifactList(
  apiUrl: string,
  apiKey: string,
  options: MontageArtifactListOptions = {},
  config?: MontageToolsConfig,
): Promise<MontageArtifactListResult> {
  return requestJson<MontageArtifactListResult>(
    apiUrl,
    apiKey,
    appendQuery("/v1/artifacts", {
      limit: options.limit,
      offset: options.offset,
    }),
    {},
    config,
  );
}

function requestArtifactDetail(
  apiUrl: string,
  apiKey: string,
  artifactId: string,
  config?: MontageToolsConfig,
): Promise<MontageArtifactDetail> {
  return requestJson<MontageArtifactDetail>(
    apiUrl,
    apiKey,
    `/v1/artifacts/${assertArtifactId(artifactId)}`,
    {},
    config,
  );
}

function requestArtifactRevisionList(
  apiUrl: string,
  apiKey: string,
  artifactId: string,
  options: MontageArtifactRevisionListOptions = {},
  config?: MontageToolsConfig,
): Promise<MontageArtifactRevisionListResult> {
  return requestJson<MontageArtifactRevisionListResult>(
    apiUrl,
    apiKey,
    appendQuery(`/v1/artifacts/${assertArtifactId(artifactId)}/revisions`, {
      limit: options.limit,
    }),
    {},
    config,
  );
}

function requestArtifactRevisionDetail(
  apiUrl: string,
  apiKey: string,
  artifactId: string,
  revisionId: string,
  config?: MontageToolsConfig,
): Promise<MontageArtifactRevisionDetail> {
  return requestJson<MontageArtifactRevisionDetail>(
    apiUrl,
    apiKey,
    `/v1/artifacts/${assertArtifactId(artifactId)}/revisions/${assertArtifactId(revisionId, "revisionId")}`,
    {},
    config,
  );
}

async function requestRestoreArtifactRevision(
  apiUrl: string,
  apiKey: string,
  artifactId: string,
  revisionId: string,
  input: MontageRestoreArtifactInput = {},
  config?: MontageToolsConfig,
): Promise<MontageArtifactLifecycleResult> {
  const responseBody = await requestJson<unknown>(
    apiUrl,
    apiKey,
    `/v1/artifacts/${assertArtifactId(artifactId)}/revisions/${assertArtifactId(revisionId, "revisionId")}/restore`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    config,
  );
  return parseArtifactLifecycleResponse(responseBody, 200);
}

async function requestRollbackArtifact(
  apiUrl: string,
  apiKey: string,
  artifactId: string,
  input: MontageRollbackArtifactInput = {},
  config?: MontageToolsConfig,
): Promise<MontageArtifactLifecycleResult> {
  const responseBody = await requestJson<unknown>(
    apiUrl,
    apiKey,
    `/v1/artifacts/${assertArtifactId(artifactId)}/rollback`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    config,
  );
  return parseArtifactLifecycleResponse(responseBody, 200);
}

async function requestForkArtifact(
  apiUrl: string,
  apiKey: string,
  artifactId: string,
  input: MontageForkArtifactInput = {},
  config?: MontageToolsConfig,
): Promise<MontageArtifactLifecycleResult> {
  const responseBody = await requestJson<unknown>(
    apiUrl,
    apiKey,
    `/v1/artifacts/${assertArtifactId(artifactId)}/fork`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    config,
  );
  return parseArtifactLifecycleResponse(responseBody, 201);
}

async function requestExportArtifact(
  apiUrl: string,
  apiKey: string,
  artifactId: string,
  options: MontageArtifactExportOptions = {},
  config?: MontageToolsConfig,
): Promise<MontageArtifactExportBundle> {
  const responseBody = await requestJson<unknown>(
    apiUrl,
    apiKey,
    appendQuery(`/v1/artifacts/${assertArtifactId(artifactId)}/export`, {
      revisionId: options.revisionId,
      format: options.format,
    }),
    {},
    config,
  );
  return parseArtifactExportResponse(responseBody, 200);
}

async function requestExportArtifactHtml(
  apiUrl: string,
  apiKey: string,
  artifactId: string,
  options: Pick<MontageArtifactExportOptions, "revisionId"> = {},
  config?: MontageToolsConfig,
): Promise<MontageArtifactHtmlExport> {
  const safeArtifactId = assertArtifactId(artifactId);
  const response = await requestText(
    apiUrl,
    apiKey,
    appendQuery(`/v1/artifacts/${safeArtifactId}/export`, {
      revisionId: options.revisionId,
      format: "html",
    }),
    {},
    config,
  );
  return {
    artifactId: safeArtifactId,
    revisionId: options.revisionId,
    html: response.text,
    contentType: response.contentType,
  };
}

async function requestExportArtifactArchive(
  apiUrl: string,
  apiKey: string,
  artifactId: string,
  options: Pick<MontageArtifactExportOptions, "revisionId"> = {},
  config?: MontageToolsConfig,
): Promise<MontageArtifactArchiveExport> {
  const responseBody = await requestJson<unknown>(
    apiUrl,
    apiKey,
    appendQuery(`/v1/artifacts/${assertArtifactId(artifactId)}/export`, {
      revisionId: options.revisionId,
      format: "archive",
    }),
    {},
    config,
  );
  return parseArtifactArchiveExportResponse(responseBody, 200);
}

function requestCompareArtifactRevisions(
  apiUrl: string,
  apiKey: string,
  artifactId: string,
  input: MontageCompareArtifactRevisionsInput,
  config?: MontageToolsConfig,
): Promise<MontageArtifactRevisionComparison> {
  return requestJson<MontageArtifactRevisionComparison>(
    apiUrl,
    apiKey,
    appendQuery(
      `/v1/artifacts/${assertArtifactId(artifactId)}/revisions/compare`,
      {
        baseRevisionId: input.baseRevisionId,
        targetRevisionId: input.targetRevisionId,
      },
    ),
    {},
    config,
  );
}

function parseRevisionProofMutationResponse(
  body: unknown,
  status: number,
): MontageRevisionProofMutationResult {
  const data = isRecord(body) && isRecord(body.data) ? body.data : body;
  if (
    !isRecord(data) ||
    !isRecord(data.proof) ||
    typeof data.proof.proofId !== "string"
  ) {
    throw new MontageApiError(
      "invalid_response",
      status,
      "Montage revision proof response did not include a proof.",
    );
  }
  return {
    proof: data.proof as unknown as MontageRevisionProofSummary,
    ...(isRecord(data.revision)
      ? {
          revision:
            data.revision as MontageRevisionProofMutationResult["revision"],
        }
      : {}),
  };
}

function requestCreateRevisionProof(
  apiUrl: string,
  apiKey: string,
  artifactId: string,
  revisionId: string,
  input: MontageCreateRevisionProofInput,
  config?: MontageToolsConfig,
): Promise<MontageRevisionProofMutationResult> {
  return requestJson<unknown>(
    apiUrl,
    apiKey,
    `/v1/artifacts/${assertArtifactId(artifactId)}/revisions/${assertArtifactId(revisionId, "revisionId")}/proofs`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    config,
  ).then((body) => parseRevisionProofMutationResponse(body, 201));
}

function requestRunRevisionProof(
  apiUrl: string,
  apiKey: string,
  artifactId: string,
  revisionId: string,
  input: MontageRunRevisionProofInput = {},
  config?: MontageToolsConfig,
): Promise<MontageRevisionProofMutationResult> {
  return requestJson<unknown>(
    apiUrl,
    apiKey,
    `/v1/artifacts/${assertArtifactId(artifactId)}/revisions/${assertArtifactId(revisionId, "revisionId")}/proofs/run`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    config,
  ).then((body) => parseRevisionProofMutationResponse(body, 201));
}

function requestRevisionProofList(
  apiUrl: string,
  apiKey: string,
  artifactId: string,
  revisionId: string,
  options: MontageRevisionProofListOptions = {},
  config?: MontageToolsConfig,
): Promise<MontageRevisionProofListResult> {
  return requestJson<MontageRevisionProofListResult>(
    apiUrl,
    apiKey,
    appendQuery(
      `/v1/artifacts/${assertArtifactId(artifactId)}/revisions/${assertArtifactId(revisionId, "revisionId")}/proofs`,
      {
        limit: options.limit,
        offset: options.offset,
      },
    ),
    {},
    config,
  );
}

function requestRevisionProofDetail(
  apiUrl: string,
  apiKey: string,
  artifactId: string,
  revisionId: string,
  proofId: string,
  config?: MontageToolsConfig,
): Promise<MontageRevisionProofDetail> {
  return requestJson<MontageRevisionProofDetail>(
    apiUrl,
    apiKey,
    `/v1/artifacts/${assertArtifactId(artifactId)}/revisions/${assertArtifactId(revisionId, "revisionId")}/proofs/${assertArtifactId(proofId, "proofId")}`,
    {},
    config,
  );
}

function requestRevisionProofAssetList(
  apiUrl: string,
  apiKey: string,
  artifactId: string,
  revisionId: string,
  proofId: string,
  config?: MontageToolsConfig,
): Promise<MontageRevisionProofAssetListResult> {
  return requestJson<MontageRevisionProofAssetListResult>(
    apiUrl,
    apiKey,
    `/v1/artifacts/${assertArtifactId(artifactId)}/revisions/${assertArtifactId(revisionId, "revisionId")}/proofs/${assertArtifactId(proofId, "proofId")}/assets`,
    {},
    config,
  );
}

function parseDesignSystemMutationResponse(
  body: unknown,
  status: number,
): MontageDesignSystemMutationResult {
  const data = isRecord(body) && isRecord(body.data) ? body.data : body;
  if (
    !isRecord(data) ||
    !isRecord(data.designSystem) ||
    typeof data.designSystem.designSystemId !== "string"
  ) {
    throw new MontageApiError(
      "invalid_response",
      status,
      "Montage design-system response did not include a design system.",
    );
  }
  return {
    designSystem: data.designSystem as unknown as MontageDesignSystemSummary,
    version: isRecord(data.version)
      ? (data.version as unknown as MontageDesignSystemVersionSummary)
      : null,
    ...(isRecord(data.forkedFrom)
      ? {
          forkedFrom:
            data.forkedFrom as MontageDesignSystemMutationResult["forkedFrom"],
        }
      : {}),
  };
}

function requestCreateDesignSystem(
  apiUrl: string,
  apiKey: string,
  input: MontageCreateDesignSystemInput,
  config?: MontageToolsConfig,
): Promise<MontageDesignSystemMutationResult> {
  return requestJson<unknown>(apiUrl, apiKey, "/v1/design-systems", {
    method: "POST",
    body: JSON.stringify(input),
  }, config).then((body) => parseDesignSystemMutationResponse(body, 201));
}

function requestDesignSystemList(
  apiUrl: string,
  apiKey: string,
  options: MontageDesignSystemListOptions = {},
  config?: MontageToolsConfig,
): Promise<MontageDesignSystemListResult> {
  return requestJson<MontageDesignSystemListResult>(
    apiUrl,
    apiKey,
    appendQuery("/v1/design-systems", {
      limit: options.limit,
      offset: options.offset,
    }),
    {},
    config,
  );
}

function requestDesignSystemDetail(
  apiUrl: string,
  apiKey: string,
  designSystemId: string,
  config?: MontageToolsConfig,
): Promise<MontageDesignSystemDetail> {
  return requestJson<MontageDesignSystemDetail>(
    apiUrl,
    apiKey,
    `/v1/design-systems/${assertArtifactId(designSystemId, "designSystemId")}`,
    {},
    config,
  );
}

function requestUpdateDesignSystem(
  apiUrl: string,
  apiKey: string,
  designSystemId: string,
  input: MontageUpdateDesignSystemInput,
  config?: MontageToolsConfig,
): Promise<MontageDesignSystemMutationResult> {
  return requestJson<unknown>(
    apiUrl,
    apiKey,
    `/v1/design-systems/${assertArtifactId(designSystemId, "designSystemId")}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    config,
  ).then((body) => parseDesignSystemMutationResponse(body, 200));
}

function requestForkDesignSystem(
  apiUrl: string,
  apiKey: string,
  designSystemId: string,
  input: MontageForkDesignSystemInput,
  config?: MontageToolsConfig,
): Promise<MontageDesignSystemMutationResult> {
  return requestJson<unknown>(
    apiUrl,
    apiKey,
    `/v1/design-systems/${assertArtifactId(designSystemId, "designSystemId")}/fork`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    config,
  ).then((body) => parseDesignSystemMutationResponse(body, 201));
}

function requestImportDesignSystem(
  apiUrl: string,
  apiKey: string,
  input: MontageCreateDesignSystemInput,
  config?: MontageToolsConfig,
): Promise<MontageDesignSystemMutationResult> {
  return requestJson<unknown>(apiUrl, apiKey, "/v1/design-systems/import", {
    method: "POST",
    body: JSON.stringify(input),
  }, config).then((body) => parseDesignSystemMutationResponse(body, 201));
}

function parseTemplateMutationResponse(
  body: unknown,
  status: number,
): MontageArtifactTemplateMutationResult {
  const data = isRecord(body) && isRecord(body.data) ? body.data : body;
  if (
    !isRecord(data) ||
    !isRecord(data.template) ||
    typeof data.template.templateId !== "string"
  ) {
    throw new MontageApiError(
      "invalid_response",
      status,
      "Montage template response did not include a template.",
    );
  }
  return {
    template: data.template as unknown as MontageArtifactTemplateSummary,
  };
}

function parseTemplateForkResponse(
  body: unknown,
  status: number,
): MontageForkArtifactTemplateResult {
  const data = isRecord(body) && isRecord(body.data) ? body.data : body;
  if (
    !isRecord(data) ||
    !isRecord(data.template) ||
    !isRecord(data.artifact) ||
    !isRecord(data.revision) ||
    !isRecord(data.forkedFrom)
  ) {
    throw new MontageApiError(
      "invalid_response",
      status,
      "Montage template fork response did not include template, artifact, revision, and forkedFrom.",
    );
  }
  return data as unknown as MontageForkArtifactTemplateResult;
}

function requestCreateTemplate(
  apiUrl: string,
  apiKey: string,
  input: MontageCreateArtifactTemplateInput,
  config?: MontageToolsConfig,
): Promise<MontageArtifactTemplateMutationResult> {
  return requestJson<unknown>(apiUrl, apiKey, "/v1/templates", {
    method: "POST",
    body: JSON.stringify(input),
  }, config).then((body) => parseTemplateMutationResponse(body, 201));
}

function requestTemplateList(
  apiUrl: string,
  apiKey: string,
  options: MontageArtifactTemplateListOptions = {},
  config?: MontageToolsConfig,
): Promise<MontageArtifactTemplateListResult> {
  return requestJson<MontageArtifactTemplateListResult>(
    apiUrl,
    apiKey,
    appendQuery("/v1/templates", {
      limit: options.limit,
      offset: options.offset,
    }),
    {},
    config,
  );
}

function requestTemplateDetail(
  apiUrl: string,
  apiKey: string,
  templateId: string,
  config?: MontageToolsConfig,
): Promise<MontageArtifactTemplateDetail> {
  return requestJson<MontageArtifactTemplateDetail>(
    apiUrl,
    apiKey,
    `/v1/templates/${assertArtifactId(templateId, "templateId")}`,
    {},
    config,
  );
}

function requestForkTemplate(
  apiUrl: string,
  apiKey: string,
  templateId: string,
  input: MontageForkArtifactTemplateInput = {},
  config?: MontageToolsConfig,
): Promise<MontageForkArtifactTemplateResult> {
  return requestJson<unknown>(
    apiUrl,
    apiKey,
    `/v1/templates/${assertArtifactId(templateId, "templateId")}/fork`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    config,
  ).then((body) => parseTemplateForkResponse(body, 201));
}

function parseOrgMutationResponse(
  body: unknown,
  status: number,
): MontageOrgMutationResult {
  const data = isRecord(body) && isRecord(body.data) ? body.data : body;
  if (
    !isRecord(data) ||
    !isRecord(data.org) ||
    !isRecord(data.member) ||
    typeof data.org.orgId !== "string" ||
    typeof data.member.userId !== "string"
  ) {
    throw new MontageApiError(
      "invalid_response",
      status,
      "Montage org response did not include an org and member.",
    );
  }
  return {
    org: data.org as unknown as MontageOrgSummary,
    member: data.member as unknown as MontageOrgMemberSummary,
  };
}

function parseOrgMemberMutationResponse(
  body: unknown,
  status: number,
): MontageOrgMemberMutationResult {
  const data = isRecord(body) && isRecord(body.data) ? body.data : body;
  if (
    !isRecord(data) ||
    !isRecord(data.member) ||
    typeof data.member.userId !== "string"
  ) {
    throw new MontageApiError(
      "invalid_response",
      status,
      "Montage org member response did not include a member.",
    );
  }
  return {
    member: data.member as unknown as MontageOrgMemberSummary,
  };
}

function requestCreateOrg(
  apiUrl: string,
  apiKey: string,
  input: MontageCreateOrgInput,
  config?: MontageToolsConfig,
): Promise<MontageOrgMutationResult> {
  return requestJson<unknown>(apiUrl, apiKey, "/v1/orgs", {
    method: "POST",
    body: JSON.stringify(input),
  }, config).then((body) => parseOrgMutationResponse(body, 201));
}

function requestOrgList(
  apiUrl: string,
  apiKey: string,
  options: MontageOrgListOptions = {},
  config?: MontageToolsConfig,
): Promise<MontageOrgListResult> {
  return requestJson<MontageOrgListResult>(
    apiUrl,
    apiKey,
    appendQuery("/v1/orgs", {
      limit: options.limit,
      offset: options.offset,
    }),
    {},
    config,
  );
}

function requestOrgDetail(
  apiUrl: string,
  apiKey: string,
  orgId: string,
  config?: MontageToolsConfig,
): Promise<MontageOrgDetail> {
  return requestJson<MontageOrgDetail>(
    apiUrl,
    apiKey,
    `/v1/orgs/${assertArtifactId(orgId, "orgId")}`,
    {},
    config,
  );
}

function requestOrgMemberList(
  apiUrl: string,
  apiKey: string,
  orgId: string,
  options: MontageOrgMemberListOptions = {},
  config?: MontageToolsConfig,
): Promise<MontageOrgMemberListResult> {
  return requestJson<MontageOrgMemberListResult>(
    apiUrl,
    apiKey,
    appendQuery(`/v1/orgs/${assertArtifactId(orgId, "orgId")}/members`, {
      limit: options.limit,
      offset: options.offset,
    }),
    {},
    config,
  );
}

function requestUpsertOrgMember(
  apiUrl: string,
  apiKey: string,
  orgId: string,
  input: MontageUpsertOrgMemberInput,
  config?: MontageToolsConfig,
): Promise<MontageOrgMemberMutationResult> {
  return requestJson<unknown>(
    apiUrl,
    apiKey,
    `/v1/orgs/${assertArtifactId(orgId, "orgId")}/members`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    config,
  ).then((body) => parseOrgMemberMutationResponse(body, 201));
}

function parseDeploymentResponse(
  body: unknown,
  status: number,
): MontageDeploymentSummary {
  const data = isRecord(body) && isRecord(body.data) ? body.data : body;
  const deployment =
    isRecord(data) && isRecord(data.deployment) ? data.deployment : data;
  if (
    !isRecord(deployment) ||
    typeof deployment.deploymentId !== "string" ||
    typeof deployment.artifactId !== "string"
  ) {
    throw new MontageApiError(
      "invalid_response",
      status,
      "Montage deployment response did not include a deployment.",
    );
  }
  return deployment as unknown as MontageDeploymentSummary;
}

function parseDeploymentCacheResponse(
  body: unknown,
  status: number,
): MontageDeploymentCacheSummary {
  const data = isRecord(body) && isRecord(body.data) ? body.data : body;
  const cache = isRecord(data) && isRecord(data.cache) ? data.cache : data;
  if (
    !isRecord(cache) ||
    typeof cache.deploymentId !== "string" ||
    typeof cache.artifactId !== "string" ||
    typeof cache.revisionId !== "string" ||
    typeof cache.status !== "string"
  ) {
    throw new MontageApiError(
      "invalid_response",
      status,
      "Montage deployment cache response did not include cache status.",
    );
  }
  return cache as unknown as MontageDeploymentCacheSummary;
}

function parseDeploymentCapabilityUsageResponse(
  body: unknown,
  status: number,
): MontageDeploymentCapabilityUsage {
  const data = isRecord(body) && isRecord(body.data) ? body.data : body;
  const usage = isRecord(data) && isRecord(data.usage) ? data.usage : data;
  if (
    !isRecord(usage) ||
    typeof usage.deploymentId !== "string" ||
    !isRecord(usage.totals) ||
    !Array.isArray(usage.capabilities) ||
    !Array.isArray(usage.recentEvents)
  ) {
    throw new MontageApiError(
      "invalid_response",
      status,
      "Montage deployment capability usage response did not include usage.",
    );
  }
  return usage as unknown as MontageDeploymentCapabilityUsage;
}

function parseDeploymentAgentActionUsageResponse(
  body: unknown,
  status: number,
): MontageDeploymentAgentActionUsage {
  const data = isRecord(body) && isRecord(body.data) ? body.data : body;
  const usage = isRecord(data) && isRecord(data.usage) ? data.usage : data;
  if (
    !isRecord(usage) ||
    typeof usage.deploymentId !== "string" ||
    !isRecord(usage.totals) ||
    !Array.isArray(usage.actions) ||
    !Array.isArray(usage.recentEvents)
  ) {
    throw new MontageApiError(
      "invalid_response",
      status,
      "Montage deployment agent-action usage response did not include usage.",
    );
  }
  return usage as unknown as MontageDeploymentAgentActionUsage;
}

function requestCreateDeployment(
  apiUrl: string,
  apiKey: string,
  input: MontageCreateDeploymentInput,
  config?: MontageToolsConfig,
): Promise<MontageDeploymentSummary> {
  return requestJson<unknown>(apiUrl, apiKey, "/v1/deployments", {
    method: "POST",
    body: JSON.stringify(input),
  }, config).then((body) => parseDeploymentResponse(body, 201));
}

function requestDeploymentList(
  apiUrl: string,
  apiKey: string,
  options: MontageDeploymentListOptions = {},
  config?: MontageToolsConfig,
): Promise<MontageDeploymentListResult> {
  return requestJson<MontageDeploymentListResult>(
    apiUrl,
    apiKey,
    appendQuery("/v1/deployments", {
      limit: options.limit,
      offset: options.offset,
    }),
    {},
    config,
  );
}

function requestDeploymentDetail(
  apiUrl: string,
  apiKey: string,
  deploymentId: string,
  config?: MontageToolsConfig,
): Promise<MontageDeploymentSummary> {
  return requestJson<unknown>(
    apiUrl,
    apiKey,
    `/v1/deployments/${assertArtifactId(deploymentId, "deploymentId")}`,
    {},
    config,
  ).then((body) => parseDeploymentResponse(body, 200));
}

function requestUpdateDeployment(
  apiUrl: string,
  apiKey: string,
  deploymentId: string,
  input: MontageUpdateDeploymentInput,
  config?: MontageToolsConfig,
): Promise<MontageDeploymentSummary> {
  return requestJson<unknown>(
    apiUrl,
    apiKey,
    `/v1/deployments/${assertArtifactId(deploymentId, "deploymentId")}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    config,
  ).then((body) => parseDeploymentResponse(body, 200));
}

function requestPromoteDeployment(
  apiUrl: string,
  apiKey: string,
  deploymentId: string,
  input: MontagePromoteDeploymentInput,
  config?: MontageToolsConfig,
): Promise<MontageDeploymentSummary> {
  return requestJson<unknown>(
    apiUrl,
    apiKey,
    `/v1/deployments/${assertArtifactId(deploymentId, "deploymentId")}/promote`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    config,
  ).then((body) => parseDeploymentResponse(body, 200));
}

function requestRevokeDeployment(
  apiUrl: string,
  apiKey: string,
  deploymentId: string,
  config?: MontageToolsConfig,
): Promise<MontageDeploymentSummary> {
  return requestJson<unknown>(
    apiUrl,
    apiKey,
    `/v1/deployments/${assertArtifactId(deploymentId, "deploymentId")}/revoke`,
    { method: "POST" },
    config,
  ).then((body) => parseDeploymentResponse(body, 200));
}

function requestDeploymentCacheStatus(
  apiUrl: string,
  apiKey: string,
  deploymentId: string,
  config?: MontageToolsConfig,
): Promise<MontageDeploymentCacheSummary> {
  return requestJson<unknown>(
    apiUrl,
    apiKey,
    `/v1/deployments/${assertArtifactId(deploymentId, "deploymentId")}/cache`,
    {},
    config,
  ).then((body) => parseDeploymentCacheResponse(body, 200));
}

function requestInvalidateDeploymentCache(
  apiUrl: string,
  apiKey: string,
  deploymentId: string,
  config?: MontageToolsConfig,
): Promise<MontageDeploymentCacheSummary> {
  return requestJson<unknown>(
    apiUrl,
    apiKey,
    `/v1/deployments/${assertArtifactId(deploymentId, "deploymentId")}/cache/invalidate`,
    { method: "POST" },
    config,
  ).then((body) => parseDeploymentCacheResponse(body, 200));
}

function requestPrewarmDeploymentCache(
  apiUrl: string,
  apiKey: string,
  deploymentId: string,
  config?: MontageToolsConfig,
): Promise<MontageDeploymentCacheSummary> {
  return requestJson<unknown>(
    apiUrl,
    apiKey,
    `/v1/deployments/${assertArtifactId(deploymentId, "deploymentId")}/cache/prewarm`,
    { method: "POST" },
    config,
  ).then((body) => parseDeploymentCacheResponse(body, 200));
}

function requestDeploymentCapabilityUsage(
  apiUrl: string,
  apiKey: string,
  deploymentId: string,
  options: MontageDeploymentCapabilityUsageOptions = {},
  config?: MontageToolsConfig,
): Promise<MontageDeploymentCapabilityUsage> {
  return requestJson<unknown>(
    apiUrl,
    apiKey,
    appendQuery(
      `/v1/deployments/${assertArtifactId(deploymentId, "deploymentId")}/capabilities/usage`,
      { limit: options.limit, since: options.since },
    ),
    {},
    config,
  ).then((body) => parseDeploymentCapabilityUsageResponse(body, 200));
}

function requestDeploymentAgentActionUsage(
  apiUrl: string,
  apiKey: string,
  deploymentId: string,
  options: MontageDeploymentAgentActionUsageOptions = {},
  config?: MontageToolsConfig,
): Promise<MontageDeploymentAgentActionUsage> {
  return requestJson<unknown>(
    apiUrl,
    apiKey,
    appendQuery(
      `/v1/deployments/${assertArtifactId(deploymentId, "deploymentId")}/agent-actions/usage`,
      { limit: options.limit, since: options.since },
    ),
    {},
    config,
  ).then((body) => parseDeploymentAgentActionUsageResponse(body, 200));
}

export function createMontageTools(config: MontageToolsConfig): MontageToolkit {
  const apiUrl = config.apiUrl ?? DEFAULT_API_URL;

  return {
    adapters: {
      configure(provider, adapterConfig) {
        return requestAdapterConfig(
          apiUrl,
          config.apiKey,
          provider,
          adapterConfig,
          config,
        );
      },
      list() {
        return requestAdapterList(apiUrl, config.apiKey, config);
      },
      remove(provider) {
        return requestAdapterRemove(apiUrl, config.apiKey, provider, config);
      },
    },

    orgs: {
      create(input) {
        return requestCreateOrg(apiUrl, config.apiKey, input, config);
      },
      list(options) {
        return requestOrgList(apiUrl, config.apiKey, options, config);
      },
      get(orgId) {
        return requestOrgDetail(apiUrl, config.apiKey, orgId, config);
      },
      listMembers(orgId, options) {
        return requestOrgMemberList(
          apiUrl,
          config.apiKey,
          orgId,
          options,
          config,
        );
      },
      upsertMember(orgId, input) {
        return requestUpsertOrgMember(
          apiUrl,
          config.apiKey,
          orgId,
          input,
          config,
        );
      },
    },

    artifacts: {
      create(input) {
        return requestCreateArtifact(apiUrl, config.apiKey, input, config);
      },
      streamCreate(input, onEvent, options) {
        return requestStreamCreateArtifact(
          apiUrl,
          config.apiKey,
          input,
          config,
          onEvent,
          options,
        );
      },
      update(artifactId, input) {
        return requestUpdateArtifact(
          apiUrl,
          config.apiKey,
          artifactId,
          input,
          config,
        );
      },
      patch(artifactId, input) {
        return requestPatchArtifact(
          apiUrl,
          config.apiKey,
          artifactId,
          input,
          config,
          "patch",
        );
      },
      restyle(artifactId, input) {
        return requestPatchArtifact(
          apiUrl,
          config.apiKey,
          artifactId,
          input,
          config,
          "restyle",
        );
      },
      list(options) {
        return requestArtifactList(apiUrl, config.apiKey, options, config);
      },
      get(artifactId) {
        return requestArtifactDetail(apiUrl, config.apiKey, artifactId, config);
      },
      listRevisions(artifactId, options) {
        return requestArtifactRevisionList(
          apiUrl,
          config.apiKey,
          artifactId,
          options,
          config,
        );
      },
      getRevision(artifactId, revisionId) {
        return requestArtifactRevisionDetail(
          apiUrl,
          config.apiKey,
          artifactId,
          revisionId,
          config,
        );
      },
      restore(artifactId, revisionId, input) {
        return requestRestoreArtifactRevision(
          apiUrl,
          config.apiKey,
          artifactId,
          revisionId,
          input,
          config,
        );
      },
      rollback(artifactId, input) {
        return requestRollbackArtifact(
          apiUrl,
          config.apiKey,
          artifactId,
          input,
          config,
        );
      },
      fork(artifactId, input) {
        return requestForkArtifact(
          apiUrl,
          config.apiKey,
          artifactId,
          input,
          config,
        );
      },
      export(artifactId, options) {
        return requestExportArtifact(
          apiUrl,
          config.apiKey,
          artifactId,
          options,
          config,
        );
      },
      exportHtml(artifactId, options) {
        return requestExportArtifactHtml(
          apiUrl,
          config.apiKey,
          artifactId,
          options,
          config,
        );
      },
      exportArchive(artifactId, options) {
        return requestExportArtifactArchive(
          apiUrl,
          config.apiKey,
          artifactId,
          options,
          config,
        );
      },
      compareRevisions(artifactId, input) {
        return requestCompareArtifactRevisions(
          apiUrl,
          config.apiKey,
          artifactId,
          input,
          config,
        );
      },
      createProof(artifactId, revisionId, input) {
        return requestCreateRevisionProof(
          apiUrl,
          config.apiKey,
          artifactId,
          revisionId,
          input,
          config,
        );
      },
      runProof(artifactId, revisionId, input) {
        return requestRunRevisionProof(
          apiUrl,
          config.apiKey,
          artifactId,
          revisionId,
          input,
          config,
        );
      },
      listProofs(artifactId, revisionId, options) {
        return requestRevisionProofList(
          apiUrl,
          config.apiKey,
          artifactId,
          revisionId,
          options,
          config,
        );
      },
      getProof(artifactId, revisionId, proofId) {
        return requestRevisionProofDetail(
          apiUrl,
          config.apiKey,
          artifactId,
          revisionId,
          proofId,
          config,
        );
      },
      listProofAssets(artifactId, revisionId, proofId) {
        return requestRevisionProofAssetList(
          apiUrl,
          config.apiKey,
          artifactId,
          revisionId,
          proofId,
          config,
        );
      },
    },

    designSystems: {
      create(input) {
        return requestCreateDesignSystem(apiUrl, config.apiKey, input, config);
      },
      list(options) {
        return requestDesignSystemList(apiUrl, config.apiKey, options, config);
      },
      get(designSystemId) {
        return requestDesignSystemDetail(
          apiUrl,
          config.apiKey,
          designSystemId,
          config,
        );
      },
      update(designSystemId, input) {
        return requestUpdateDesignSystem(
          apiUrl,
          config.apiKey,
          designSystemId,
          input,
          config,
        );
      },
      fork(designSystemId, input) {
        return requestForkDesignSystem(
          apiUrl,
          config.apiKey,
          designSystemId,
          input,
          config,
        );
      },
      import(input) {
        return requestImportDesignSystem(apiUrl, config.apiKey, input, config);
      },
    },

    templates: {
      create(input) {
        return requestCreateTemplate(apiUrl, config.apiKey, input, config);
      },
      list(options) {
        return requestTemplateList(apiUrl, config.apiKey, options, config);
      },
      get(templateId) {
        return requestTemplateDetail(apiUrl, config.apiKey, templateId, config);
      },
      fork(templateId, input) {
        return requestForkTemplate(
          apiUrl,
          config.apiKey,
          templateId,
          input,
          config,
        );
      },
    },

    deployments: {
      create(input) {
        return requestCreateDeployment(apiUrl, config.apiKey, input, config);
      },
      list(options) {
        return requestDeploymentList(apiUrl, config.apiKey, options, config);
      },
      get(deploymentId) {
        return requestDeploymentDetail(
          apiUrl,
          config.apiKey,
          deploymentId,
          config,
        );
      },
      update(deploymentId, input) {
        return requestUpdateDeployment(
          apiUrl,
          config.apiKey,
          deploymentId,
          input,
          config,
        );
      },
      promote(deploymentId, input) {
        return requestPromoteDeployment(
          apiUrl,
          config.apiKey,
          deploymentId,
          input,
          config,
        );
      },
      revoke(deploymentId) {
        return requestRevokeDeployment(
          apiUrl,
          config.apiKey,
          deploymentId,
          config,
        );
      },
      getCache(deploymentId) {
        return requestDeploymentCacheStatus(
          apiUrl,
          config.apiKey,
          deploymentId,
          config,
        );
      },
      invalidateCache(deploymentId) {
        return requestInvalidateDeploymentCache(
          apiUrl,
          config.apiKey,
          deploymentId,
          config,
        );
      },
      prewarmCache(deploymentId) {
        return requestPrewarmDeploymentCache(
          apiUrl,
          config.apiKey,
          deploymentId,
          config,
        );
      },
      getCapabilityUsage(deploymentId, options) {
        return requestDeploymentCapabilityUsage(
          apiUrl,
          config.apiKey,
          deploymentId,
          options,
          config,
        );
      },
      getAgentActionUsage(deploymentId, options) {
        return requestDeploymentAgentActionUsage(
          apiUrl,
          config.apiKey,
          deploymentId,
          options,
          config,
        );
      },
    },

    async execute(input: MontageGenerateInput): Promise<MontageGenerateResult> {
      const body = createGenerateBody(input, config, {});

      let response: Response;
      try {
        response = await fetch(`${apiUrl}/v1/generate`, {
          method: "POST",
          headers: buildSdkRequestHeaders(config.apiKey, config, {
            "Content-Type": "application/json",
          }),
          body: JSON.stringify(body),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
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
        artifactId?: string;
        version?: string;
        htmlBundleRef?: string | null;
        hostedUrl?: string;
        resolution?: MontageGenerationResolution;
        diagnostics?: MontageGenerationDiagnostic[];
      };
      const html =
        typeof data.html === "string" ? data.html : data.artifact?.html;
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
        ...(data.artifactId ? { artifactId: data.artifactId } : {}),
        ...(data.version ? { version: data.version } : {}),
        ...(data.htmlBundleRef ? { htmlBundleRef: data.htmlBundleRef } : {}),
        ...(data.hostedUrl ? { hostedUrl: data.hostedUrl } : {}),
        ...(data.resolution ? { resolution: data.resolution } : {}),
        ...(data.diagnostics ? { diagnostics: data.diagnostics } : {}),
      };
    },

    async stream(
      input: MontageGenerateInput,
      options: MontageStreamOptions,
    ): Promise<MontageStreamResult> {
      const abortController = new AbortController();
      const abort = () => abortController.abort();
      if (options.signal) {
        if (options.signal.aborted) abort();
        options.signal.addEventListener("abort", abort, { once: true });
      }

      let cleanupMount: () => void = () => {};
      let cleanupBridge: (() => void) | null = null;
      let cleanupFrameBridge: (() => void) | null = null;
      let cleanupAliases: (() => void) | null = null;
      let finalResult: MontageStreamResult | null = null;
      let mountedShellHtml: string | null = null;
      let pendingArtifactMetadata: Partial<
        Pick<
          MontageStreamResult,
          | "id"
          | "creditsUsed"
          | "cacheKey"
          | "artifactId"
          | "version"
          | "htmlBundleRef"
          | "hostedUrl"
          | "resolution"
          | "diagnostics"
        >
      > = {};
      let hasPendingSlotPaint = false;
      const mountMode = isIframeTarget(options.target)
        ? "inline"
        : (options.mountMode ?? "inline");
      const executeScripts = options.previewScripts !== false;
      const mountedSlots = new Map<string, MountedStreamSlot>();
      let streamRenderDiagnostics: MontageGenerationDiagnostic[] = [];

      const renderErrorMessage = (error: unknown): string =>
        error instanceof Error ? error.message : String(error);

      const recordStreamRenderFailure = (
        phase: string,
        error: unknown,
      ): void => {
        streamRenderDiagnostics.push({
          code: "stream-render-failed",
          severity: "warning",
          phase,
          message: `Montage stream rendering failed locally, but the stream continued: ${renderErrorMessage(error)}`,
        });
      };

      const completeStream = (
        finalHtml: string,
        event: Partial<
          Extract<MontageGenerateStreamEvent, { type: "done" | "artifact" }>
        > = {},
        extraDiagnostics: MontageGenerationDiagnostic[] = [],
      ): MontageStreamResult => {
        const derivedParts = event.parts ?? extractHtmlBlockPayload(finalHtml);
        const diagnostics = [
          ...(event.diagnostics ?? pendingArtifactMetadata.diagnostics ?? []),
          ...extraDiagnostics,
        ];
        try {
          cleanupMount();
          ensureBridge();
          cleanupMount = mountStreamHtml(
            options.target,
            finalHtml,
            true,
            mountMode,
            executeScripts,
          );
          refreshBridge();
          refreshFrameBridge();
          refreshAliases();
        } catch (error) {
          cleanupMount = () => {};
          diagnostics.push({
            code: "stream-render-failed",
            severity: "warning",
            phase: "sdk-stream-finalize",
            message: `Montage final stream rendering failed locally, but the final streamed artifact was preserved: ${renderErrorMessage(error)}`,
          });
        }
        const result: MontageStreamResult = {
          html: finalHtml,
          parts: derivedParts,
          id: event.id ?? pendingArtifactMetadata.id,
          creditsUsed: event.creditsUsed ?? pendingArtifactMetadata.creditsUsed,
          cacheKey: event.cacheKey ?? pendingArtifactMetadata.cacheKey,
          artifactId: event.artifactId ?? pendingArtifactMetadata.artifactId,
          version: event.version ?? pendingArtifactMetadata.version,
          htmlBundleRef:
            event.htmlBundleRef ?? pendingArtifactMetadata.htmlBundleRef,
          hostedUrl: event.hostedUrl ?? pendingArtifactMetadata.hostedUrl,
          resolution: event.resolution ?? pendingArtifactMetadata.resolution,
          diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
          cleanup: () => {
            cleanupMount();
            cleanupBridge?.();
            cleanupFrameBridge?.();
            cleanupAliases?.();
            cleanupBridge = null;
            cleanupFrameBridge = null;
            cleanupAliases = null;
          },
          abort,
        };
        finalResult = result;
        options.onDone?.(finalResult);
        return result;
      };

      const completeBestEffortStream = (
        message: string,
        event: Partial<
          Extract<MontageGenerateStreamEvent, { type: "done" | "artifact" }>
        > = {},
      ): MontageStreamResult | null => {
        if (finalResult) return finalResult;
        const previewHtml = buildBestEffortStreamHtml(
          options.target,
          mountedShellHtml,
          mountedSlots,
        );
        if (typeof previewHtml !== "string") return null;
        return completeStream(previewHtml, event, [
          {
            code: "stream-preview-fallback",
            severity: "warning",
            phase: "sdk-stream-finalize",
            message,
          },
        ]);
      };

      const fail = (error: MontageApiError): never => {
        try {
          options.onError?.(error);
        } finally {
          cleanupMount();
          cleanupBridge?.();
          cleanupFrameBridge?.();
          cleanupAliases?.();
          cleanupBridge = null;
          cleanupFrameBridge = null;
          cleanupAliases = null;
        }
        throw error;
      };

      const ensureBridge = () => {
        if (cleanupBridge || !options.adapter) return;
        cleanupBridge = installStreamCapabilityBridge(
          options.target,
          mountMode,
          options,
        );
      };

      const refreshBridge = () => {
        cleanupBridge?.();
        cleanupBridge = null;
        ensureBridge();
      };

      const refreshFrameBridge = () => {
        cleanupFrameBridge?.();
        cleanupFrameBridge = null;
        if (!options.adapter) return;
        cleanupFrameBridge = installStreamFrameCapabilityBridge(
          options.target,
          mountMode,
        );
      };

      const refreshAliases = () => {
        cleanupAliases?.();
        cleanupAliases = null;
        if (!options.adapter || !options.capabilityAliases?.length) return;
        cleanupAliases = installStreamCapabilityAliasBridge(
          options.target,
          mountMode,
          options,
        );
      };

      try {
        const body = createGenerateBody(input, config, {
          streaming: true,
          output: "html",
        });
        if (options.adapter) {
          body.adapterManifest = options.adapter.getCapabilityManifest();
        }

        let response: Response;
        try {
          response = await fetch(`${apiUrl}/v1/generate`, {
            method: "POST",
            headers: buildSdkRequestHeaders(config.apiKey, config, {
              "Content-Type": "application/json",
            }),
            body: JSON.stringify(body),
            signal: abortController.signal,
          });
        } catch (error) {
          if (abortController.signal.aborted) {
            return fail(
              new MontageApiError(
                "aborted",
                0,
                "Montage streaming request aborted.",
              ),
            );
          }
          const message =
            error instanceof Error ? error.message : String(error);
          return fail(
            new MontageApiError(
              "network",
              0,
              `Montage API streaming request failed: ${message}`,
            ),
          );
        }

        if (!response.ok) {
          return fail(await readApiError(response));
        }

        try {
          await readMontageSseResponse(response, async (rawEvent, rawChunk) => {
            const event = normalizeMontageStreamEvent(rawEvent);
            if (!event) return;
            if (finalResult) return;

            if (event.type === "status") {
              options.onStatus?.(event.text);
            } else if (event.type === "shell") {
              mountedShellHtml = event.html;
              try {
                cleanupMount();
                ensureBridge();
                cleanupMount = mountStreamHtml(
                  options.target,
                  event.html,
                  false,
                  mountMode,
                  executeScripts,
                );
                refreshBridge();
                refreshFrameBridge();
                refreshAliases();
                hasPendingSlotPaint = false;
                for (const [slot, mounted] of mountedSlots) {
                  patchStreamSlot(
                    options.target,
                    slot,
                    mounted.html,
                    mounted.styles,
                    mounted.stylesheets,
                    mountMode,
                    executeScripts,
                  );
                  refreshBridge();
                  refreshFrameBridge();
                  refreshAliases();
                  hasPendingSlotPaint = true;
                }
              } catch (error) {
                cleanupMount = () => {};
                hasPendingSlotPaint = false;
                recordStreamRenderFailure("sdk-stream-shell", error);
              }
            } else if (event.type === "slot") {
              ensureBridge();
              const styles = (event as Record<string, unknown>).styles as
                | string
                | undefined;
              const stylesheets = (event as Record<string, unknown>)
                .stylesheets as string[] | undefined;
              mountedSlots.set(event.slot, {
                html: event.html,
                styles,
                stylesheets,
              });
              try {
                patchStreamSlot(
                  options.target,
                  event.slot,
                  event.html,
                  styles,
                  stylesheets,
                  mountMode,
                  executeScripts,
                );
                refreshBridge();
                refreshFrameBridge();
                refreshAliases();
                hasPendingSlotPaint = true;
              } catch (error) {
                hasPendingSlotPaint = false;
                recordStreamRenderFailure("sdk-stream-slot", error);
              }
            } else if (event.type === "done" || event.type === "artifact") {
              if (hasPendingSlotPaint) {
                await waitForStreamSlotPaint(options.target);
                hasPendingSlotPaint = false;
              }
              if (abortController.signal.aborted) {
                return fail(
                  new MontageApiError(
                    "aborted",
                    0,
                    "Montage streaming request aborted.",
                  ),
                );
              }
              pendingArtifactMetadata = {
                ...pendingArtifactMetadata,
                ...(event.id !== undefined ? { id: event.id } : {}),
                ...(event.creditsUsed !== undefined
                  ? { creditsUsed: event.creditsUsed }
                  : {}),
                ...(event.cacheKey !== undefined
                  ? { cacheKey: event.cacheKey }
                  : {}),
                ...(event.artifactId !== undefined
                  ? { artifactId: event.artifactId }
                  : {}),
                ...(event.version !== undefined
                  ? { version: event.version }
                  : {}),
                ...(event.htmlBundleRef !== undefined
                  ? { htmlBundleRef: event.htmlBundleRef }
                  : {}),
                ...(event.hostedUrl !== undefined
                  ? { hostedUrl: event.hostedUrl }
                  : {}),
                ...(event.resolution !== undefined
                  ? { resolution: event.resolution }
                  : {}),
                ...(event.diagnostics !== undefined
                  ? { diagnostics: event.diagnostics }
                  : {}),
              };
              const finalHtml = htmlFromFinalStreamParts(event) ?? event.html;
              if (typeof finalHtml !== "string") {
                if (event.type === "artifact") {
                  options.onEvent?.(event, rawChunk);
                  return;
                }
                if (
                  completeBestEffortStream(
                    "Final stream event did not include compiled HTML, so the latest streamed preview was completed as the artifact.",
                    event,
                  )
                ) {
                  options.onEvent?.(event, rawChunk);
                  return;
                }
                return fail(
                  new MontageApiError(
                    "invalid_response",
                    response.status,
                    "Montage API stream ended before a final artifact was received.",
                  ),
                );
              }
              completeStream(finalHtml, event, streamRenderDiagnostics);
              streamRenderDiagnostics = [];
            } else if (event.type === "error") {
              if (
                completeBestEffortStream(
                  `Stream ended after rendering a usable preview: ${event.text}`,
                )
              ) {
                options.onEvent?.(event, rawChunk);
                return;
              }
              fail(
                new MontageApiError(
                  "stream_error",
                  response.status,
                  event.text,
                ),
              );
            }
            options.onEvent?.(event, rawChunk);
          });
        } catch (error) {
          if (abortController.signal.aborted) {
            return fail(
              new MontageApiError(
                "aborted",
                0,
                "Montage streaming request aborted.",
              ),
            );
          }
          if (finalResult) return finalResult;
          if (error instanceof MontageApiError) throw error;
          const message =
            error instanceof Error ? error.message : String(error);
          const bestEffortResult = completeBestEffortStream(
            `Montage API stream failed after rendering a usable preview: ${message}`,
          );
          if (bestEffortResult) return bestEffortResult;
          return fail(
            new MontageApiError(
              "stream_error",
              response.status,
              `Montage API stream failed: ${message}`,
            ),
          );
        }

        if (!finalResult) {
          const bestEffortResult = completeBestEffortStream(
            "Montage API stream ended before a final artifact was received, so the latest streamed preview was completed as the artifact.",
          );
          if (bestEffortResult) {
            return bestEffortResult;
          }
          return fail(
            new MontageApiError(
              "invalid_response",
              response.status,
              "Montage API stream ended before a final artifact was received.",
            ),
          );
        }

        return finalResult;
      } finally {
        if (options.signal) {
          options.signal.removeEventListener("abort", abort);
        }
      }
    },

    async executeStreaming(
      input: MontageGenerateInput,
      onEvent: (event: MontageGenerateStreamEvent, rawChunk: string) => void,
      options: { signal?: AbortSignal } = {},
    ): Promise<void> {
      const body = createGenerateBody(input, config, {
        streaming: true,
        output: "html",
      });

      let response: Response;
      try {
        response = await fetch(`${apiUrl}/v1/generate`, {
          method: "POST",
          headers: buildSdkRequestHeaders(config.apiKey, config, {
            "Content-Type": "application/json",
          }),
          body: JSON.stringify(body),
          signal: options.signal,
        });
      } catch (error) {
        if (options.signal?.aborted) {
          throw new MontageApiError(
            "aborted",
            0,
            "Montage streaming request aborted.",
          );
        }
        const message = error instanceof Error ? error.message : String(error);
        throw new MontageApiError(
          "network",
          0,
          `Montage API streaming request failed: ${message}`,
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

        const errorObj = errorBody.error ?? errorBody;
        throw new MontageApiError(
          errorObj.code ?? "api_error",
          response.status,
          errorObj.message ??
            `Montage API returned ${response.status} ${response.statusText}`,
        );
      }

      if (!response.body) {
        throw new MontageApiError(
          "invalid_response",
          response.status,
          "Montage API streaming response did not include a body.",
        );
      }
      await readMontageSseResponse(response, onEvent);
    },

    async executeFragment(
      input: MontageGenerateInput,
    ): Promise<MontageGenerateFragmentResult> {
      const body = createGenerateBody(input, config, { output: "fragment" });

      let response: Response;
      try {
        response = await fetch(`${apiUrl}/v1/generate`, {
          method: "POST",
          headers: buildSdkRequestHeaders(config.apiKey, config, {
            "Content-Type": "application/json",
          }),
          body: JSON.stringify(body),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
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
        fragment?: string;
        html?: string;
        styles?: string;
        stylesheets?: string[];
        scripts?: string[];
        creditsUsed: number;
        artifactId?: string;
        hostedUrl?: string;
        resolution?: MontageGenerationResolution;
        diagnostics?: MontageGenerationDiagnostic[];
      };

      if (typeof data.fragment !== "string") {
        throw new MontageApiError(
          "invalid_response",
          response.status,
          "Montage API response did not include a fragment.",
        );
      }

      return {
        id: data.id,
        fragment: data.fragment,
        styles: data.styles,
        stylesheets: data.stylesheets,
        scripts: data.scripts,
        creditsUsed: data.creditsUsed,
        ...(data.html ? { html: data.html } : {}),
        ...(data.artifactId ? { artifactId: data.artifactId } : {}),
        ...(data.hostedUrl ? { hostedUrl: data.hostedUrl } : {}),
        ...(data.resolution ? { resolution: data.resolution } : {}),
        ...(data.diagnostics ? { diagnostics: data.diagnostics } : {}),
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
