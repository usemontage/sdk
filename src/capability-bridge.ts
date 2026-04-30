import { MontageError } from "./errors";
import type {
  MontageAdapter,
  MontageAgentDescriptor,
} from "./agent-adapter";
import type { MontageCapabilityInvokeRequest } from "./types";

interface MontageArtifactHost {
  invoke?: (request: MontageCapabilityInvokeRequest) => unknown;
  [key: string]: unknown;
}

type GlobalWithMontageArtifactHost = typeof globalThis & {
  MontageAOT?: MontageArtifactHost;
};

function getArtifactHost(): MontageArtifactHost | undefined {
  return (globalThis as GlobalWithMontageArtifactHost).MontageAOT;
}

function setArtifactHost(host: MontageArtifactHost): void {
  (globalThis as GlobalWithMontageArtifactHost).MontageAOT = host;
}

function restoreArtifactHost(previousHost: MontageArtifactHost | undefined): void {
  if (previousHost) {
    setArtifactHost(previousHost);
  } else {
    delete (globalThis as GlobalWithMontageArtifactHost).MontageAOT;
  }
}

export interface MontageCapabilityBridgeErrorContext {
  request: MontageCapabilityInvokeRequest;
}

export interface MontageCapabilityBridgeOptions<
  TAgent extends MontageAgentDescriptor,
> {
  root?: Document | ShadowRoot | HTMLElement;
  adapter: MontageAdapter<TAgent>;
  context?: unknown;
  onError?: (
    error: MontageError,
    context: MontageCapabilityBridgeErrorContext,
  ) => void;
}

function toMontageError(error: unknown): MontageError {
  if (error instanceof MontageError) return error;
  return new MontageError(
    "capability.invalid-request",
    error instanceof Error ? error.message : "Unknown capability invocation failure.",
    { cause: error },
  );
}

function findAdapterCapability<TAgent extends MontageAgentDescriptor>(
  adapter: MontageAdapter<TAgent>,
  request: MontageCapabilityInvokeRequest,
) {
  const source = request.source ?? request.name;
  return adapter.listCapabilities().find((capability) =>
    capability.name === request.name
    || capability.source === source
    || capability.name === source
  );
}

function renderCapabilityError(root: Document | ShadowRoot | HTMLElement | undefined, error: MontageError): void {
  const doc = root && "ownerDocument" in root && root.ownerDocument
    ? root.ownerDocument
    : typeof document !== "undefined"
      ? document
      : undefined;
  if (!doc?.createElement) return;
  const host = (root as { nodeType?: number } | undefined)?.nodeType === 9
    ? (root as Document).body
    : typeof Document !== "undefined" && root instanceof Document
      ? root.body
      : root && "appendChild" in root
      ? root
      : doc.body;
  if (!host) return;
  const existing = "querySelector" in host ? host.querySelector("[data-montage-capability-error]") : null;
  const node = existing ?? doc.createElement("div");
  node.setAttribute("data-montage-capability-error", "true");
  node.setAttribute("role", "status");
  node.textContent = error.message;
  if (!existing) {
    node.setAttribute("style", "position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:360px;padding:12px 14px;border-radius:12px;background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;box-shadow:0 18px 40px rgba(15,23,42,.16);font:600 13px system-ui,sans-serif");
    host.appendChild(node);
  }
}

function capabilityError(
  code: MontageError["code"],
  message: string,
): MontageError {
  return new MontageError(code, message);
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return Boolean(value && typeof value === "object" && typeof (value as { then?: unknown }).then === "function");
}

function assertRequestShape(request: unknown): asserts request is MontageCapabilityInvokeRequest {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw capabilityError("capability.invalid-request", "Capability invocation must receive a request object.");
  }
  const record = request as Record<string, unknown>;
  if (typeof record.name !== "string" || record.name.trim().length === 0) {
    throw capabilityError("capability.invalid-request", "Capability invocation must include a capability name.");
  }
  if (record.effect !== "pure" && record.effect !== "query" && record.effect !== "effect") {
    throw capabilityError("capability.invalid-request", "Capability invocation must include effect pure, query, or effect.");
  }
}

function normalizeRequest(
  request: MontageCapabilityInvokeRequest,
  context: unknown,
): MontageCapabilityInvokeRequest {
  return {
    name: request.name,
    source: request.source ?? request.name,
    effect: request.effect,
    args: Array.isArray(request.args) ? request.args : [],
    context: request.context ?? context,
  };
}

export function bindMontageCapabilityBridge<TAgent extends MontageAgentDescriptor>(
  options: MontageCapabilityBridgeOptions<TAgent>,
): () => void {
  const { adapter, root, context, onError } = options;
  const previousHost = getArtifactHost();
  const previousInvoke = previousHost?.invoke;

  const handleError = (error: unknown, request: MontageCapabilityInvokeRequest): never => {
    const montageError = toMontageError(error);
    renderCapabilityError(root, montageError);
    onError?.(montageError, { request });
    if (typeof console !== "undefined" && typeof console.error === "function") {
      console.error(montageError);
    }
    throw montageError;
  };

  const invoke = (rawRequest: MontageCapabilityInvokeRequest): unknown => {
    try {
      assertRequestShape(rawRequest);
      const request = normalizeRequest(rawRequest, context);
      const adapterCapability = findAdapterCapability(adapter, request);
      if (adapterCapability) {
        if (adapterCapability.availability === "declared") {
          throw capabilityError(
            "capability.unavailable",
            `Capability "${request.name}" requires an adapter implementation.`,
          );
        }
        if (adapterCapability.effect !== request.effect) {
          throw capabilityError(
            "capability.effect-mismatch",
            `Capability "${request.name}" is registered as "${adapterCapability.effect}", not "${request.effect}".`,
          );
        }
        const result = adapter.invokeCapability(request);
        if (request.effect === "pure" && isPromiseLike(result)) {
          result.catch(() => undefined);
          throw capabilityError(
            "capability.invalid-request",
            `Pure capability "${request.name}" must return synchronously.`,
          );
        }
        return result;
      }

      if (previousInvoke) {
        return previousInvoke.call(previousHost, request);
      }

      throw capabilityError("capability.unknown", `Unknown Montage capability: "${request.name}".`);
    } catch (error) {
      return handleError(error, rawRequest);
    }
  };

  setArtifactHost({
    ...(previousHost ?? {}),
    invoke,
  });

  return () => {
    restoreArtifactHost(previousHost);
  };
}
