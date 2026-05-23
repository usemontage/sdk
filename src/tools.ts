import type {
  MontageDesignSystemConfig,
  MontageGenerateFragmentResult,
} from "./public-types";
import { mountHtmlBlock } from "./html/mount-html-block";
import { extractHtmlBlockPayload } from "./html/html-block-payload";
import type {
  MontageAdapter,
  MontageAgentDescriptor,
} from "./agent-adapter";
import type {
  MontageCapabilityErrorHandler,
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

export interface MontageGenerateInput {
  prompt: string;
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

export type MontageGenerateStreamEvent =
  | { type: "status"; text: string; [key: string]: unknown }
  | { type: "shell"; html: string; cacheKey?: string; text?: string; [key: string]: unknown }
  | { type: "slot"; slot: string; html: string; cacheKey?: string; text?: string; [key: string]: unknown }
  | {
      type: "done";
      html: string;
      parts?: { fragment: string; styles?: string; stylesheets?: string[]; scripts?: string[]; externalScripts?: string[] };
      id?: string;
      creditsUsed?: number;
      cacheKey?: string;
      artifactId?: string;
      version?: string;
      hostedUrl?: string;
      resolution?: MontageGenerationResolution;
      diagnostics?: MontageGenerationDiagnostic[];
      text?: string;
      [key: string]: unknown;
    }
  | { type: "error"; text: string; [key: string]: unknown };

export interface MontageStreamResult {
  html: string;
  parts?: { fragment: string; styles?: string; stylesheets?: string[]; scripts?: string[]; externalScripts?: string[] };
  id?: string;
  creditsUsed?: number;
  cacheKey?: string;
  artifactId?: string;
  version?: string;
  hostedUrl?: string;
  resolution?: MontageGenerationResolution;
  diagnostics?: MontageGenerationDiagnostic[];
  cleanup(): void;
  abort(): void;
}

export interface MontageStreamOptions {
  target: HTMLElement | HTMLIFrameElement;
  signal?: AbortSignal;
  adapter?: MontageAdapter<MontageAgentDescriptor>;
  context?: Record<string, unknown>;
  onCapabilityError?: MontageCapabilityErrorHandler;
  onStatus?: (text: string) => void;
  onDone?: (result: MontageStreamResult) => void;
  onError?: (error: MontageApiError) => void;
  /**
   * Advanced diagnostic hook. The default SDK path applies shell/slot/done
   * events before exposing public rendered HTML updates here.
   */
  onEvent?: (event: MontageGenerateStreamEvent, rawChunk: string) => void;
}

export interface MontageStreamSurface {
  applyEvent(event: MontageGenerateStreamEvent): Promise<void>;
  cleanup(): void;
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
  executeFragment(input: MontageGenerateInput): Promise<MontageGenerateFragmentResult>;
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

"prompt": A product-level render brief. Include the user goal, audience, workflow, entities, required interactions, constraints, and anti-goals. Do not emit implementation-only source formats, raw HTML, or a low-level layout blueprint.
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
    typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function"
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
  required: ["prompt", "dataInfo"],
  properties: {
    prompt: {
      type: "string",
      description:
        "Product-level render brief: goal, audience, workflow, entities, required interactions, constraints, and anti-goals. Do not emit implementation-only source formats, raw HTML, or a low-level layout blueprint.",
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

function htmlToFragment(ownerDocument: Document, html: string): DocumentFragment {
  const template = ownerDocument.createElement("template");
  const parserCtor = ownerDocument.defaultView?.DOMParser ?? globalThis.DOMParser;
  if (/<(?:!doctype|html|head|body)(?:\s|>)/i.test(html) && parserCtor) {
    const parsed = new parserCtor().parseFromString(html, "text/html");
    const headAssets = Array.from(
      parsed.head.querySelectorAll("link[rel='stylesheet'],style"),
    )
      .map((node) => node.outerHTML)
      .join("");
    template.innerHTML = `${headAssets}${parsed.body.innerHTML}`;
  } else {
    template.innerHTML = html;
  }
  return template.content.cloneNode(true) as DocumentFragment;
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
// Streaming layout note:
//   CSS `transform` on an SVG element fully REPLACES its `transform` attribute
//   (they don't compose — see CSS Transforms Level 1). So any SVG <g> with a
//   class targeted below MUST NOT carry a `transform=""` attribute; positioning
//   transforms must live on an unclassed outer <g> wrapper.
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

function injectStreamTransitionStyle(doc: Document): void {
  if (doc.querySelector("style[data-mtg-stream-transitions]")) return;
  const style = doc.createElement("style");
  style.setAttribute("data-mtg-stream-transitions", "true");
  style.textContent = STREAM_TRANSITION_CSS;
  (doc.head ?? doc.documentElement ?? doc.body)?.appendChild(style);
}

function mountStreamHtml(
  target: HTMLElement | HTMLIFrameElement,
  html: string,
  isDone = false,
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

  const fragment = htmlToFragment(target.ownerDocument, html);
  target.replaceChildren(fragment);
  if (!isDone) {
    target.setAttribute("data-mtg-streaming", "true");
  } else {
    target.removeAttribute("data-mtg-streaming");
  }
  injectStreamTransitionStyle(target.ownerDocument);
  return () => target.replaceChildren();
}

function getStreamRoot(target: HTMLElement | HTMLIFrameElement): HTMLElement | null {
  if (isIframeTarget(target)) {
    return target.contentDocument?.body ?? null;
  }
  return target;
}

function findStreamSlot(root: HTMLElement, slot: string): HTMLElement | null {
  for (const element of Array.from(root.querySelectorAll<HTMLElement>("[data-mtg-stream-slot]"))) {
    if (element.getAttribute("data-mtg-stream-slot") === slot) return element;
  }
  return null;
}

function patchStreamSlot(
  target: HTMLElement | HTMLIFrameElement,
  slot: string,
  html: string,
  styles?: string,
  stylesheets?: string[],
): void {
  const root = getStreamRoot(target);
  if (!root) return;

  const ownerDocument = root.ownerDocument;
  let slotElement = findStreamSlot(root, slot);
  const isNew = !slotElement;
  if (!slotElement) {
    slotElement = ownerDocument.createElement("section");
    slotElement.setAttribute("data-mtg-stream-slot", slot);
    const container =
      root.querySelector<HTMLElement>("[data-mtg-stream-slots]") ??
      root.querySelector<HTMLElement>("#mtg-streaming-sections") ??
      root;
    container.appendChild(slotElement);
  }

  if (styles) {
    const styleKey = `mtg-stream-slot-style-${slot}`;
    let styleEl = root.querySelector<HTMLStyleElement>(`style[data-mtg-slot-style="${slot}"]`);
    if (!styleEl) {
      styleEl = ownerDocument.createElement("style");
      styleEl.setAttribute("data-mtg-slot-style", slot);
      root.insertBefore(styleEl, root.firstChild);
    }
    if (styleEl.textContent !== styles) styleEl.textContent = styles;
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

  const allIframes = Array.from(slotElement.querySelectorAll<HTMLIFrameElement>("iframe[srcdoc]"));
  const existingIframe = allIframes.find((f) => f.hasAttribute("data-mtg-active"))
    ?? allIframes[allIframes.length - 1]
    ?? null;
  const fragment = htmlToFragment(ownerDocument, html);
  const incomingIframe = fragment.querySelector<HTMLIFrameElement>("iframe[srcdoc]");

  if (existingIframe && incomingIframe) {
    const nextSrcdoc = incomingIframe.getAttribute("srcdoc") ?? "";
    const prevLen = (existingIframe as HTMLIFrameElement & { _mtgSrcdocLen?: number })._mtgSrcdocLen ?? 0;
    const isFinal = nextSrcdoc.length > 0 && nextSrcdoc.length - prevLen < 200;
    if (!isFinal && nextSrcdoc.length - prevLen < 400 && prevLen > 0) {
      return;
    }
    (existingIframe as HTMLIFrameElement & { _mtgSrcdocLen?: number })._mtgSrcdocLen = nextSrcdoc.length;
    const doc = existingIframe.contentDocument;
    if (doc && doc.body) {
      const parserCtor = ownerDocument.defaultView?.DOMParser ?? globalThis.DOMParser;
      const incoming = new parserCtor().parseFromString(nextSrcdoc, "text/html");
      for (const style of Array.from(incoming.head.querySelectorAll("style"))) {
        const id = style.id || style.getAttribute("data-id");
        const existing = id ? doc.head.querySelector(`style#${id}`) : null;
        if (existing) {
          existing.textContent = style.textContent;
        } else {
          const clone = doc.importNode(style, true);
          if (!id) clone.setAttribute("data-id", `mtg-injected-${doc.head.querySelectorAll("style").length}`);
          doc.head.appendChild(clone);
        }
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
    const newIframe = slotElement.querySelector<HTMLIFrameElement>("iframe[srcdoc]");
    if (newIframe) {
      newIframe.style.opacity = "0";
      newIframe.addEventListener("load", () => {
        newIframe.style.transition = "opacity 0.4s ease";
        newIframe.style.opacity = "1";
      }, { once: true });
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
    prompt: input.prompt,
    dataInfo: input.dataInfo,
    interactive: input.interactive ?? false,
    requestId: resolveRequestId(input.requestId),
  };
  if (input.zeroed !== undefined) body.zeroed = input.zeroed;
  if (input.title) body.title = input.title;
  if (input.data !== undefined) body.data = input.data;
  if (input.hosted !== undefined) body.hosted = input.hosted;
  if (input.strictData !== undefined) body.strictData = input.strictData;
  if (input.requiredFields) body.requiredFields = input.requiredFields;
  if (input.requiredCapabilities) body.requiredCapabilities = input.requiredCapabilities;
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

export async function readMontageSseResponse<TEvent = MontageGenerateStreamEvent>(
  response: Response,
  onEvent: (
    event: TEvent,
    rawChunk: string,
  ) => void | Promise<void>,
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
): MontageStreamSurface {
  let cleanupMount: () => void = () => {};
  let hasPendingSlotPaint = false;

  const cleanup = () => {
    cleanupMount();
    cleanupMount = () => {};
    hasPendingSlotPaint = false;
  };

  return {
    async applyEvent(event: MontageGenerateStreamEvent): Promise<void> {
      if (event.type === "shell") {
        cleanupMount();
        cleanupMount = mountStreamHtml(target, event.html);
        hasPendingSlotPaint = false;
        return;
      }

      if (event.type === "slot") {
        patchStreamSlot(
          target,
          event.slot,
          event.html,
          (event as Record<string, unknown>).styles as string | undefined,
          (event as Record<string, unknown>).stylesheets as string[] | undefined,
        );
        hasPendingSlotPaint = true;
        return;
      }

      if (event.type === "done") {
        if (hasPendingSlotPaint) {
          await waitForStreamSlotPaint(target);
          hasPendingSlotPaint = false;
        }
        cleanupMount();
        cleanupMount = mountStreamHtml(target, event.html, true);
        return;
      }

      if (event.type === "error") {
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
  config: Record<string, string>,
): Promise<void> {
  const response = await fetch(`${apiUrl}/v1/adapters/${encodeURIComponent(provider)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(config),
  });
  if (!response.ok) throw await readApiError(response);
}

async function requestAdapterList(
  apiUrl: string,
  apiKey: string,
): Promise<AdapterConfigSummary[]> {
  const response = await fetch(`${apiUrl}/v1/adapters`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) throw await readApiError(response);
  const body = (await response.json()) as { data?: AdapterConfigSummary[] };
  return body.data ?? [];
}

async function requestAdapterRemove(
  apiUrl: string,
  apiKey: string,
  provider: string,
): Promise<void> {
  const response = await fetch(`${apiUrl}/v1/adapters/${encodeURIComponent(provider)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) throw await readApiError(response);
}

export function createMontageTools(config: MontageToolsConfig): MontageToolkit {
  const apiUrl = config.apiUrl ?? DEFAULT_API_URL;

  return {
    adapters: {
      configure(provider, adapterConfig) {
        return requestAdapterConfig(apiUrl, config.apiKey, provider, adapterConfig);
      },
      list() {
        return requestAdapterList(apiUrl, config.apiKey);
      },
      remove(provider) {
        return requestAdapterRemove(apiUrl, config.apiKey, provider);
      },
    },

    async execute(input: MontageGenerateInput): Promise<MontageGenerateResult> {
      const body = createGenerateBody(input, config, {});

      let response: Response;
      try {
        response = await fetch(`${apiUrl}/v1/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify(body),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
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
        hostedUrl?: string;
        resolution?: MontageGenerationResolution;
        diagnostics?: MontageGenerationDiagnostic[];
      };
      const html = typeof data.html === "string" ? data.html : data.artifact?.html;
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
      let finalResult: MontageStreamResult | null = null;
      let hasPendingSlotPaint = false;

      const fail = (error: MontageApiError): never => {
        try {
          options.onError?.(error);
        } finally {
          cleanupMount();
        }
        throw error;
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
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify(body),
            signal: abortController.signal,
          });
        } catch (error) {
          if (abortController.signal.aborted) {
            return fail(new MontageApiError(
              "aborted",
              0,
              "Montage streaming request aborted.",
            ));
          }
          const message =
            error instanceof Error ? error.message : String(error);
          return fail(new MontageApiError(
            "network",
            0,
            `Montage API streaming request failed: ${message}`,
          ));
        }

        if (!response.ok) {
          return fail(await readApiError(response));
        }

        try {
          await readMontageSseResponse(response, async (event, rawChunk) => {
            if (event.type === "status") {
              options.onStatus?.(event.text);
            } else if (event.type === "shell") {
              cleanupMount();
              cleanupMount = mountStreamHtml(options.target, event.html);
              hasPendingSlotPaint = false;
            } else if (event.type === "slot") {
              patchStreamSlot(options.target, event.slot, event.html, (event as Record<string,unknown>).styles as string | undefined, (event as Record<string,unknown>).stylesheets as string[] | undefined);
              hasPendingSlotPaint = true;
            } else if (event.type === "done") {
              if (hasPendingSlotPaint) {
                await waitForStreamSlotPaint(options.target);
                hasPendingSlotPaint = false;
              }
              if (abortController.signal.aborted) {
                return fail(new MontageApiError(
                  "aborted",
                  0,
                  "Montage streaming request aborted.",
                ));
              }
              cleanupMount();
              cleanupMount = mountStreamHtml(options.target, event.html, true);
              const derivedParts = event.parts ?? extractHtmlBlockPayload(event.html);
              finalResult = {
                html: event.html,
                parts: derivedParts,
                id: event.id,
                creditsUsed: event.creditsUsed,
                cacheKey: event.cacheKey,
                artifactId: event.artifactId,
                version: event.version,
                hostedUrl: event.hostedUrl,
                resolution: event.resolution,
                diagnostics: event.diagnostics,
                cleanup: () => {
                  cleanupMount();
                },
                abort,
              };
              options.onDone?.(finalResult);
            } else if (event.type === "error") {
              fail(new MontageApiError(
                "stream_error",
                response.status,
                event.text,
              ));
            }
            options.onEvent?.(event, rawChunk);
          });
        } catch (error) {
          if (abortController.signal.aborted) {
            return fail(new MontageApiError(
              "aborted",
              0,
              "Montage streaming request aborted.",
            ));
          }
          if (error instanceof MontageApiError) throw error;
          const message = error instanceof Error ? error.message : String(error);
          return fail(new MontageApiError(
            "stream_error",
            response.status,
            `Montage API stream failed: ${message}`,
          ));
        }

        if (!finalResult) {
          return fail(new MontageApiError(
            "invalid_response",
            response.status,
            "Montage API stream ended before a final artifact was received.",
          ));
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
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
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
        const message =
          error instanceof Error ? error.message : String(error);
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
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify(body),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
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
