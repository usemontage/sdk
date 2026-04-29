import type {
  MontageAdapter,
  MontageAgentDescriptor,
} from "../agent-adapter";
import {
  bindMontageCapabilityBridge,
  type MontageCapabilityBridgeErrorContext,
} from "../capability-bridge";
import type { MontageError } from "../errors";

export interface MountedHtmlBlockOptions<
  TAgent extends MontageAgentDescriptor = MontageAgentDescriptor,
> {
  host: HTMLElement;
  html: string;
  adapter?: MontageAdapter<TAgent>;
  context?: unknown;
  onCapabilityError?: (
    error: MontageError,
    context: MontageCapabilityBridgeErrorContext,
  ) => void;
}

const SCRIPT_BRIDGE_KEY = "__MONTAGE_SDK_AOT_BRIDGE__";

interface ScriptSnapshot {
  attrs: Array<[string, string]>;
  text: string;
}

interface HtmlPayload {
  fragment: DocumentFragment;
  scripts: ScriptSnapshot[];
}

function isFullDocument(html: string): boolean {
  return /<(?:!doctype|html|head|body)(?:\s|>)/i.test(html);
}

function createHtmlPayload(ownerDocument: Document, html: string): HtmlPayload {
  const template = ownerDocument.createElement("template");
  if (
    isFullDocument(html)
    && typeof DOMParser !== "undefined"
  ) {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const headAssets = Array.from(
      parsed.head.querySelectorAll("link[rel='stylesheet'],style"),
    )
      .map((node) => node.outerHTML)
      .join("");
    template.innerHTML = `${headAssets}${parsed.body.innerHTML}`;
  } else {
    template.innerHTML = html;
  }

  const scripts: ScriptSnapshot[] = [];
  for (const script of Array.from(template.content.querySelectorAll("script"))) {
    scripts.push({
      attrs: Array.from(script.attributes).map(({ name, value }) => [name, value]),
      text: script.textContent ?? "",
    });
    script.remove();
  }
  return {
    fragment: template.content.cloneNode(true) as DocumentFragment,
    scripts,
  };
}

function appendExecutableScript(
  host: HTMLElement,
  snapshot: ScriptSnapshot,
  bridgeHost?: typeof globalThis.MontageAOT,
): void {
  const script = host.ownerDocument.createElement("script");
  script.async = false;
  if (bridgeHost) {
    (script as HTMLScriptElement & Record<string, unknown>)[SCRIPT_BRIDGE_KEY] = bridgeHost;
  }
  for (const [name, value] of snapshot.attrs) {
    script.setAttribute(name, value);
  }
  const bridgePrefix = bridgeHost
    ? `globalThis.MontageAOT = document.currentScript && document.currentScript.${SCRIPT_BRIDGE_KEY};\n`
    : "";
  script.textContent = `${bridgePrefix}${snapshot.text}`;
  host.appendChild(script);
}

export function mountHtmlBlock<
  TAgent extends MontageAgentDescriptor = MontageAgentDescriptor,
>(input: MountedHtmlBlockOptions<TAgent>): () => void {
  const { host } = input;
  const hostWindow = host.ownerDocument.defaultView as
    | (Window & typeof globalThis)
    | null;
  const previousWindowAot = hostWindow?.MontageAOT;
  const cleanupBridge = input.adapter
    ? bindMontageCapabilityBridge({
        adapter: input.adapter,
        context: input.context,
        root: host,
        onError: input.onCapabilityError,
      })
    : () => {};
  const bridgeHost = input.adapter ? globalThis.MontageAOT : undefined;

  const payload = createHtmlPayload(host.ownerDocument, input.html);
  host.replaceChildren(payload.fragment);
  for (const script of payload.scripts) {
    appendExecutableScript(host, script, bridgeHost);
  }

  return () => {
    cleanupBridge();
    if (hostWindow && hostWindow.MontageAOT === bridgeHost) {
      if (previousWindowAot) {
        hostWindow.MontageAOT = previousWindowAot;
      } else {
        delete hostWindow.MontageAOT;
      }
    }
    host.replaceChildren();
  };
}
