import type {
  MontageAdapter,
  MontageAgentDescriptor,
} from "../agent-adapter";
import type { MontageCapabilityBridgeErrorContext } from "../capability-bridge";
import { MontageError } from "../errors";
import type {
  MontageCapabilityEffect,
  MontageCapabilityInvokeRequest,
} from "../types";

export const IFRAME_BRIDGE_PROTOCOL = "montage-iframe-bridge/v1";

export interface InvokeMessage {
  protocol: typeof IFRAME_BRIDGE_PROTOCOL;
  kind: "invoke";
  callId: string;
  name: string;
  source?: string;
  effect: MontageCapabilityEffect;
  args?: unknown;
  context?: unknown;
}

export interface ResultMessage {
  protocol: typeof IFRAME_BRIDGE_PROTOCOL;
  kind: "result";
  callId: string;
  ok: boolean;
  value?: unknown;
  error?: string;
}

export interface ParentIframeBridgeOptions<
  TAgent extends MontageAgentDescriptor = MontageAgentDescriptor,
> {
  adapter: MontageAdapter<TAgent>;
  targetWindow: Window;
  targetOrigin?: string;
  context?: unknown;
  onCapabilityError?: (
    error: MontageError,
    context: MontageCapabilityBridgeErrorContext,
  ) => void;
}

export interface ParentIframeBridge {
  handleMessage(event: MessageEvent): Promise<void>;
  detach(): void;
}

function isInvokeMessage(value: unknown): value is InvokeMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.protocol === IFRAME_BRIDGE_PROTOCOL
    && record.kind === "invoke"
    && typeof record.callId === "string"
    && typeof record.name === "string"
    && (record.effect === "pure" || record.effect === "query" || record.effect === "effect");
}

function normalizeRequest(
  message: InvokeMessage,
  context: unknown,
): MontageCapabilityInvokeRequest {
  return {
    name: message.name,
    source: message.source ?? message.name,
    effect: message.effect,
    args: message.args === undefined ? [] : message.args as never,
    context: message.context ?? context,
  };
}

function toMontageError(error: unknown): MontageError {
  if (error instanceof MontageError) return error;
  return new MontageError(
    "capability.invalid-request",
    error instanceof Error ? error.message : "Unknown capability invocation failure.",
    { cause: error },
  );
}

export function createParentIframeBridge<
  TAgent extends MontageAgentDescriptor = MontageAgentDescriptor,
>(options: ParentIframeBridgeOptions<TAgent>): ParentIframeBridge {
  const targetOrigin = options.targetOrigin ?? "*";

  async function handleMessage(event: MessageEvent): Promise<void> {
    if (event.source && event.source !== options.targetWindow) return;
    if (!isInvokeMessage(event.data)) return;

    const request = normalizeRequest(event.data, options.context);
    try {
      const value = await options.adapter.invokeCapability(request);
      const reply: ResultMessage = {
        protocol: IFRAME_BRIDGE_PROTOCOL,
        kind: "result",
        callId: event.data.callId,
        ok: true,
        value,
      };
      options.targetWindow.postMessage(reply, targetOrigin);
    } catch (error) {
      const montageError = toMontageError(error);
      options.onCapabilityError?.(montageError, { request });
      const reply: ResultMessage = {
        protocol: IFRAME_BRIDGE_PROTOCOL,
        kind: "result",
        callId: event.data.callId,
        ok: false,
        error: montageError.message,
      };
      options.targetWindow.postMessage(reply, targetOrigin);
    }
  }

  const listener = (event: MessageEvent) => {
    void handleMessage(event);
  };
  if (typeof window !== "undefined") {
    window.addEventListener("message", listener);
  }

  return {
    handleMessage,
    detach() {
      if (typeof window !== "undefined") {
        window.removeEventListener("message", listener);
      }
    },
  };
}

export function buildChildBridgeScript(): string {
  return `
(function() {
  if (window.MontageAOT && typeof window.MontageAOT.invoke === "function") return;
  var protocol = "${IFRAME_BRIDGE_PROTOCOL}";
  var pending = {};
  var nextId = 1;
  window.addEventListener("message", function(event) {
    var data = event && event.data;
    if (!data || data.protocol !== protocol || data.kind !== "result") return;
    var callbacks = pending[data.callId];
    if (!callbacks) return;
    delete pending[data.callId];
    if (data.ok) {
      callbacks.resolve(data.value);
    } else {
      callbacks.reject(new Error(data.error || "Capability invocation failed."));
    }
  });
  window.MontageAOT = {
    invoke: function(call) {
      return new Promise(function(resolve, reject) {
        var callId = String(nextId++);
        pending[callId] = { resolve: resolve, reject: reject };
        parent.postMessage({
          protocol: protocol,
          kind: "invoke",
          callId: callId,
          name: call && call.name,
          source: call && call.source,
          effect: call && call.effect,
          args: call && call.args,
          context: call && call.context
        }, "*");
      });
    }
  };
})();
`.trim();
}
