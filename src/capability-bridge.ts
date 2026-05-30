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

export type MontageCapabilityBridgeEventPhase = "start" | "success" | "error";

export interface MontageCapabilityBridgeEvent {
  phase: MontageCapabilityBridgeEventPhase;
  request: MontageCapabilityInvokeRequest;
  result?: unknown;
  error?: {
    code?: string;
    message: string;
  };
  durationMs?: number;
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
  onEvent?: (event: MontageCapabilityBridgeEvent) => void;
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
    args: request.args === undefined ? [] : request.args,
    context: request.context ?? context,
  };
}

function capabilityArgNeedsValue(value: unknown): boolean {
  return value == null || value === "" || (Array.isArray(value) && value.length === 0);
}

function capabilityFormArgKey(key: string): string {
  const stripped = key.replace(/^form(?=[A-Z_:-])/, "").trim();
  if (!stripped) return "";
  return stripped.charAt(0).toLowerCase() + stripped.slice(1);
}

function capabilityFieldValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): unknown {
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

function assignCapabilityFormArg(
  args: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  if (!key || capabilityArgNeedsValue(value)) return;
  args[key] = value;
}

function isVisibleCapabilityField(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): boolean {
  if (element.disabled) return false;
  const InputCtor = element.ownerDocument.defaultView?.HTMLInputElement;
  if (InputCtor && element instanceof InputCtor && element.type === "hidden") return false;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (style && (style.display === "none" || style.visibility === "hidden")) return false;
  return true;
}

function collectCapabilityFormArgsFromScope(
  scope: Document | ShadowRoot | HTMLElement,
  args: Record<string, unknown>,
  visited: WeakSet<object>,
): void {
  if (visited.has(scope)) return;
  visited.add(scope);
  if (!("querySelectorAll" in scope)) return;
  const fields = scope.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    "input, textarea, select",
  );
  for (const field of Array.from(fields)) {
    if (!isVisibleCapabilityField(field)) continue;
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
    const argKey = capabilityFormArgKey(key);
    if (!argKey) continue;
    const value = capabilityFieldValue(field);
    assignCapabilityFormArg(args, argKey, value);
    if (/^form/.test(key)) assignCapabilityFormArg(args, key, value);
    if (/(note|comment)/i.test(argKey)) assignCapabilityFormArg(args, "note", value);
    if (/stage/i.test(argKey)) assignCapabilityFormArg(args, "stage", value);
    if (/threshold/i.test(argKey)) assignCapabilityFormArg(args, "threshold", value);
  }
  for (const element of Array.from(scope.querySelectorAll<HTMLElement>("*"))) {
    if (element.shadowRoot) {
      collectCapabilityFormArgsFromScope(element.shadowRoot, args, visited);
    }
    if (element.tagName === "IFRAME") {
      try {
        const frameDocument = (element as HTMLIFrameElement).contentDocument;
        if (frameDocument) collectCapabilityFormArgsFromScope(frameDocument, args, visited);
      } catch {
        // Cross-origin frames are outside the SDK bridge boundary.
      }
    }
  }
}

function collectCapabilityFormArgs(
  root: Document | ShadowRoot | HTMLElement | undefined,
): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  if (!root || !("querySelectorAll" in root)) return args;
  collectCapabilityFormArgsFromScope(root, args, new WeakSet<object>());
  return args;
}

function mergeCapabilityFormArgsObject(
  args: Record<string, unknown>,
  formArgs: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...args };
  for (const key of Object.keys(next)) {
    if (capabilityArgNeedsValue(next[key]) && !capabilityArgNeedsValue(formArgs[key])) {
      next[key] = formArgs[key];
    }
  }
  return next;
}

function mergeVisibleCapabilityFormArgs(
  requestArgs: unknown,
  root: Document | ShadowRoot | HTMLElement | undefined,
): unknown {
  if (!requestArgs || typeof requestArgs !== "object") return requestArgs;
  const formArgs = collectCapabilityFormArgs(root);
  if (Object.keys(formArgs).length === 0) return requestArgs;
  if (
    Array.isArray(requestArgs) &&
    requestArgs.length === 1 &&
    requestArgs[0] &&
    typeof requestArgs[0] === "object" &&
    !Array.isArray(requestArgs[0])
  ) {
    return [mergeCapabilityFormArgsObject(requestArgs[0] as Record<string, unknown>, formArgs)];
  }
  if (!Array.isArray(requestArgs)) {
    return mergeCapabilityFormArgsObject(requestArgs as Record<string, unknown>, formArgs);
  }
  return requestArgs;
}

function capabilityEventError(error: unknown): MontageCapabilityBridgeEvent["error"] {
  const montageError = toMontageError(error);
  return {
    code: montageError.code,
    message: montageError.message,
  };
}

function eventTargetForRoot(
  root: Document | ShadowRoot | HTMLElement | undefined,
): EventTarget | undefined {
  if (root && typeof root.dispatchEvent === "function") return root;
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") return window;
  const maybeGlobal = globalThis as typeof globalThis & {
    dispatchEvent?: EventTarget["dispatchEvent"];
  };
  return typeof maybeGlobal.dispatchEvent === "function" ? maybeGlobal : undefined;
}

function customEventCtor(
  root: Document | ShadowRoot | HTMLElement | undefined,
): typeof CustomEvent | undefined {
  const ownerDocument = root && "ownerDocument" in root ? root.ownerDocument : undefined;
  const fromOwner = ownerDocument?.defaultView?.CustomEvent;
  if (typeof fromOwner === "function") return fromOwner;
  return typeof CustomEvent === "function" ? CustomEvent : undefined;
}

function emitCapabilityEvent(
  root: Document | ShadowRoot | HTMLElement | undefined,
  onEvent: ((event: MontageCapabilityBridgeEvent) => void) | undefined,
  event: MontageCapabilityBridgeEvent,
): void {
  onEvent?.(event);
  const target = eventTargetForRoot(root);
  const EventCtor = customEventCtor(root);
  if (!target || !EventCtor) return;
  target.dispatchEvent(
    new EventCtor("montage:capability", {
      bubbles: true,
      composed: true,
      detail: event,
    }),
  );
}

export function bindMontageCapabilityBridge<TAgent extends MontageAgentDescriptor>(
  options: MontageCapabilityBridgeOptions<TAgent>,
): () => void {
  const { adapter, root, context, onError, onEvent } = options;
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
    let request: MontageCapabilityInvokeRequest | undefined;
    const startedAt = Date.now();
    const finishSuccess = (result: unknown): unknown => {
      if (request) {
        emitCapabilityEvent(root, onEvent, {
          phase: "success",
          request,
          result,
          durationMs: Date.now() - startedAt,
        });
      }
      return result;
    };
    const finishError = (error: unknown): never => {
      if (request) {
        emitCapabilityEvent(root, onEvent, {
          phase: "error",
          request,
          error: capabilityEventError(error),
          durationMs: Date.now() - startedAt,
        });
      }
      return handleError(error, request ?? rawRequest);
    };

    try {
      assertRequestShape(rawRequest);
      request = normalizeRequest(rawRequest, context);
      request = {
        ...request,
        args: mergeVisibleCapabilityFormArgs(request.args, root),
      };
      const adapterCapability = findAdapterCapability(adapter, request);
      if (adapterCapability) {
        if (adapterCapability.availability === "declared") {
          throw capabilityError(
            "capability.unavailable",
            `Capability "${request.name}" requires an adapter implementation.`,
          );
        }
        if (adapterCapability.effect !== request.effect) {
          request = {
            ...request,
            source: request.source ?? adapterCapability.source ?? adapterCapability.name,
            effect: adapterCapability.effect,
          };
        }
        emitCapabilityEvent(root, onEvent, {
          phase: "start",
          request,
        });
        const result = adapter.invokeCapability(request);
        if (request.effect === "pure" && isPromiseLike(result)) {
          result.catch(() => undefined);
          throw capabilityError(
            "capability.invalid-request",
            `Pure capability "${request.name}" must return synchronously.`,
          );
        }
        if (isPromiseLike(result)) {
          return result.then(finishSuccess, finishError);
        }
        return finishSuccess(result);
      }

      emitCapabilityEvent(root, onEvent, {
        phase: "start",
        request,
      });
      if (previousInvoke) {
        const result = previousInvoke.call(previousHost, request);
        if (isPromiseLike(result)) {
          return result.then(finishSuccess, finishError);
        }
        return finishSuccess(result);
      }

      throw capabilityError("capability.unknown", `Unknown Montage capability: "${request.name}".`);
    } catch (error) {
      return finishError(error);
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
