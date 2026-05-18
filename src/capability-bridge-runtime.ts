import type {
  MontageAdapter,
  MontageAgentDescriptor,
} from "./agent-adapter";
import type { MontageCapabilityBridgeErrorContext } from "./capability-bridge";
import { MontageError } from "./errors";
import type {
  MontageCapabilityEffect,
  MontageCapabilityInvokeRequest,
} from "./types";

export interface CapabilityInvokeArgs {
  name: string;
  source?: string;
  effect: MontageCapabilityEffect;
  args?: unknown;
  context?: unknown;
}

export interface PdfExportArgs {
  root: HTMLElement;
  filename?: string;
}

export interface MontageAOTRuntime {
  invoke(args: CapabilityInvokeArgs): Promise<unknown>;
  exportToPdf?(args: PdfExportArgs): Promise<void>;
  [key: string]: unknown;
}

export interface InstallSdkBridgeArgs<
  TAgent extends MontageAgentDescriptor = MontageAgentDescriptor,
> {
  mode: "sdk";
  adapter: MontageAdapter<TAgent>;
  context?: unknown;
  root?: Document | ShadowRoot | HTMLElement;
  onCapabilityError?: (
    error: MontageError,
    context: MontageCapabilityBridgeErrorContext,
  ) => void;
}

export interface HostedBindingEntry {
  mode: "direct" | "proxy";
  effect: "query" | "effect";
  url?: string;
  headers?: Record<string, string>;
  subjectClaim?: string;
}

export interface HostedBindingManifest {
  bindings: Record<string, HostedBindingEntry>;
  corsOrigins: string[];
  updatedAt: string;
}

export interface InstallHostedBridgeArgs {
  mode: "hosted";
  bindingManifest: HostedBindingManifest;
  artifactId: string;
  proxyBaseUrl: string;
  runtimeContext: { subject?: string; [key: string]: unknown };
  onCapabilityError?: (
    error: MontageError,
    context: MontageCapabilityBridgeErrorContext,
  ) => void;
}

export type InstallBridgeArgs<
  TAgent extends MontageAgentDescriptor = MontageAgentDescriptor,
> = InstallSdkBridgeArgs<TAgent> | InstallHostedBridgeArgs;

type GlobalWithMontageAOT = typeof globalThis & {
  MontageAOT?: MontageAOTRuntime;
};

interface InstalledBridge {
  cleanup(): void;
}

const installedBridges: InstalledBridge[] = [];

function getGlobalMontageAOT(): MontageAOTRuntime | undefined {
  return (globalThis as GlobalWithMontageAOT).MontageAOT;
}

function setGlobalMontageAOT(host: MontageAOTRuntime): void {
  (globalThis as GlobalWithMontageAOT).MontageAOT = host;
}

function restoreGlobalMontageAOT(previousHost: MontageAOTRuntime | undefined): void {
  if (previousHost) {
    setGlobalMontageAOT(previousHost);
  } else {
    delete (globalThis as GlobalWithMontageAOT).MontageAOT;
  }
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return Boolean(value && typeof value === "object" && typeof (value as { then?: unknown }).then === "function");
}

function toMontageError(error: unknown): MontageError {
  if (error instanceof MontageError) return error;
  return new MontageError(
    "capability.invalid-request",
    error instanceof Error ? error.message : "Unknown capability invocation failure.",
    { cause: error },
  );
}

function capabilityError(
  code: MontageError["code"],
  message: string,
): MontageError {
  return new MontageError(code, message);
}

function assertInvokeArgs(call: unknown): asserts call is CapabilityInvokeArgs {
  if (!call || typeof call !== "object" || Array.isArray(call)) {
    throw capabilityError("capability.invalid-request", "Capability invocation must receive a request object.");
  }

  const record = call as Record<string, unknown>;
  if (typeof record.name !== "string" || record.name.trim().length === 0) {
    throw capabilityError("capability.invalid-request", "Capability invocation must include a capability name.");
  }

  if (record.effect !== "pure" && record.effect !== "query" && record.effect !== "effect") {
    throw capabilityError("capability.invalid-request", "Capability invocation must include effect pure, query, or effect.");
  }
}

function normalizeRequest(
  call: CapabilityInvokeArgs,
  bridgeContext: unknown,
): MontageCapabilityInvokeRequest {
  return {
    name: call.name,
    source: call.source ?? call.name,
    effect: call.effect,
    args: call.args === undefined ? [] : call.args as never,
    context: call.context ?? bridgeContext,
  };
}

function renderCapabilityError(
  root: Document | ShadowRoot | HTMLElement | undefined,
  error: MontageError,
): void {
  const doc = root && "ownerDocument" in root && root.ownerDocument
    ? root.ownerDocument
    : typeof document !== "undefined"
      ? document
      : undefined;
  if (!doc?.createElement) return;

  const host = root && "appendChild" in root
    ? root
    : doc.body;
  if (!host) return;

  const existing = "querySelector" in host
    ? host.querySelector("[data-montage-capability-error]")
    : null;
  const node = existing ?? doc.createElement("div");
  node.setAttribute("data-montage-capability-error", "true");
  node.setAttribute("role", "status");
  node.textContent = error.message;
  if (!existing) {
    node.setAttribute("style", "position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:360px;padding:12px 14px;border-radius:12px;background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;box-shadow:0 18px 40px rgba(15,23,42,.16);font:600 13px system-ui,sans-serif");
    host.appendChild(node);
  }
}

async function invokeHostedCapability(
  args: InstallHostedBridgeArgs,
  request: MontageCapabilityInvokeRequest,
): Promise<unknown> {
  const entry = args.bindingManifest.bindings[request.name];
  if (!entry) {
    throw capabilityError(
      "capability.invalid-request",
      `Capability "${request.name}" has no binding.`,
    );
  }

  if (entry.mode === "direct") {
    if (!entry.url) {
      throw capabilityError(
        "capability.invalid-request",
        `Capability "${request.name}" direct binding requires a URL.`,
      );
    }
    const response = await fetch(entry.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(entry.headers ?? {}),
      },
      credentials: "include",
      body: JSON.stringify({
        name: request.name,
        args: request.args,
        subject: args.runtimeContext.subject,
      }),
    });
    if (!response.ok) {
      throw capabilityError(
        "capability.invalid-request",
        `Capability "${request.name}" returned ${response.status}.`,
      );
    }
    return await response.json();
  }

  if (entry.mode === "proxy") {
    const base = args.proxyBaseUrl.replace(/\/$/, "");
    const response = await fetch(
      `${base}/v1/proxy/${args.artifactId}/${encodeURIComponent(request.name)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ args: request.args }),
      },
    );
    if (!response.ok) {
      throw capabilityError(
        "capability.invalid-request",
        `Capability proxy "${request.name}" returned ${response.status}.`,
      );
    }
    return await response.json();
  }

  throw capabilityError(
    "capability.invalid-request",
    `Unknown binding mode "${(entry as { mode?: unknown }).mode}".`,
  );
}

function removeInstalledBridge(bridge: InstalledBridge): void {
  const index = installedBridges.lastIndexOf(bridge);
  if (index >= 0) installedBridges.splice(index, 1);
}

let pdfLibsPromise: Promise<{ html2canvas: (el: HTMLElement, opts: Record<string, unknown>) => Promise<HTMLCanvasElement>; jsPDF: new (opts: Record<string, unknown>) => { addPage(): void; addImage(data: string, format: string, x: number, y: number, w: number, h: number): void; save(filename: string): void } }> | null = null;

function loadPdfLibs() {
  if (pdfLibsPromise) return pdfLibsPromise;
  pdfLibsPromise = new Promise((resolve, reject) => {
    const s1 = document.createElement("script");
    s1.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    s1.onload = () => {
      const s2 = document.createElement("script");
      s2.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js";
      s2.onload = () => resolve({ html2canvas: (globalThis as any).html2canvas, jsPDF: (globalThis as any).jspdf.jsPDF });
      s2.onerror = () => reject(new Error("Failed to load jsPDF"));
      document.head.appendChild(s2);
    };
    s1.onerror = () => reject(new Error("Failed to load html2canvas"));
    document.head.appendChild(s1);
  });
  return pdfLibsPromise;
}

async function defaultExportToPdf(args: PdfExportArgs): Promise<void> {
  const libs = await loadPdfLibs();
  const canvas = await libs.html2canvas(args.root, { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" });
  const imgWidth = 210;
  const pageHeight = 297;
  const imgHeight = canvas.height * imgWidth / canvas.width;
  const pdf = new libs.jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  let position = 0;
  const imgData = canvas.toDataURL("image/png");
  while (position < imgHeight) {
    if (position > 0) pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, -position, imgWidth, imgHeight);
    position += pageHeight;
  }
  let filename = args.filename ?? "report.pdf";
  if (!/\.pdf$/i.test(filename)) filename += ".pdf";
  pdf.save(filename);
}

export function installCapabilityBridge<
  TAgent extends MontageAgentDescriptor = MontageAgentDescriptor,
>(args: InstallBridgeArgs<TAgent>): () => void {
  const previousHost = getGlobalMontageAOT();
  const previousInvoke = previousHost?.invoke;
  const root = args.mode === "sdk" ? args.root : undefined;

  const handleError = (
    error: unknown,
    request: MontageCapabilityInvokeRequest,
  ): never => {
    const montageError = toMontageError(error);
    renderCapabilityError(root, montageError);
    args.onCapabilityError?.(montageError, { request });
    if (typeof console !== "undefined" && typeof console.error === "function") {
      console.error(montageError);
    }
    throw montageError;
  };

  const invoke: MontageAOTRuntime["invoke"] = async (rawCall) => {
    let request: MontageCapabilityInvokeRequest | undefined;
    try {
      assertInvokeArgs(rawCall);
      request = normalizeRequest(
        rawCall,
        args.mode === "sdk" ? args.context : args.runtimeContext,
      );
      if (args.mode === "hosted") {
        return await invokeHostedCapability(args, request);
      }
      try {
        const result = args.adapter.invokeCapability(request);
        if (request.effect === "pure" && isPromiseLike(result)) {
          result.catch(() => undefined);
          throw capabilityError(
            "capability.invalid-request",
            `Pure capability "${request.name}" must return synchronously.`,
          );
        }
        return await result;
      } catch (error) {
        if (
          error instanceof MontageError
          && error.code === "capability.unknown"
          && previousInvoke
        ) {
          return await previousInvoke.call(previousHost, request);
        }
        throw error;
      }
    } catch (error) {
      return handleError(error, request ?? {
        name: typeof rawCall?.name === "string" ? rawCall.name : "unknown",
        source: typeof rawCall?.source === "string" ? rawCall.source : undefined,
        effect: rawCall?.effect === "pure" || rawCall?.effect === "query" || rawCall?.effect === "effect"
          ? rawCall.effect
          : "effect",
        args: [],
      });
    }
  };

  const host: MontageAOTRuntime = {
    ...(previousHost ?? {}),
    invoke,
    exportToPdf: previousHost?.exportToPdf ?? defaultExportToPdf,
  };
  setGlobalMontageAOT(host);

  const bridge: InstalledBridge = {
    cleanup() {
      removeInstalledBridge(bridge);
      if (getGlobalMontageAOT() === host) {
        restoreGlobalMontageAOT(previousHost);
      }
    },
  };
  installedBridges.push(bridge);
  return bridge.cleanup;
}

export function uninstallCapabilityBridge(): void {
  for (const bridge of [...installedBridges].reverse()) {
    bridge.cleanup();
  }
  installedBridges.length = 0;
}
