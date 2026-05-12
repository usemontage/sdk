/**
 * Mount a full bundled HTML document inside an iframe with style isolation,
 * automatic body-class normalization, and content-driven height resizing.
 *
 * Use this when the Montage API returns a complete `<!DOCTYPE html>...</html>`
 * artifact — typical for `/v1/generate`. For HTML *fragments* (no doctype/html/
 * body wrappers), use `mountHtmlBlock` instead.
 */

import type {
  MontageAdapter,
  MontageAgentDescriptor,
} from "../agent-adapter";
import type { MontageCapabilityBridgeErrorContext } from "../capability-bridge";
import type { MontageError } from "../errors";
import {
  buildChildBridgeScript,
  createParentIframeBridge,
  type ParentIframeBridge,
} from "./iframe-bridge";

const FRAGMENT_ROOT_CLASS = "mtg-fragment-root";

export interface MountedIframeHtmlBlockOptions<
  TAgent extends MontageAgentDescriptor = MontageAgentDescriptor,
> {
  /** Container element. The iframe is appended as a child and replaces previous mounts. */
  host: HTMLElement;
  /** Full HTML document string. */
  html: string;
  /** Sandbox attributes. Defaults to `allow-scripts allow-same-origin allow-forms allow-popups`. */
  sandbox?: string;
  /** Iframe title for a11y. Defaults to "Montage rendered artifact". */
  title?: string;
  /** Minimum height in px before content measures. Defaults to 400. */
  minHeight?: number;
  /** Called whenever the iframe's measured content height changes. */
  onResize?: (heightPx: number) => void;
  /** Capability adapter bridged into the iframe as `MontageAOT.invoke`. */
  adapter?: MontageAdapter<TAgent>;
  /** Context passed into adapter capability invocations. */
  context?: unknown;
  onCapabilityError?: (
    error: MontageError,
    context: MontageCapabilityBridgeErrorContext,
  ) => void;
  /** postMessage target origin. Defaults to "*" for srcdoc/sandbox compatibility. */
  targetOrigin?: string;
}

const DEFAULT_SANDBOX =
  "allow-scripts allow-same-origin allow-forms allow-popups";

export function mountIframeHtmlBlock<
  TAgent extends MontageAgentDescriptor = MontageAgentDescriptor,
>(
  input: MountedIframeHtmlBlockOptions<TAgent>,
): () => void {
  const {
    host,
    html: rawHtml,
    sandbox = DEFAULT_SANDBOX,
    title = "Montage rendered artifact",
    minHeight = 400,
    onResize,
  } = input;

  const ownerDocument = host.ownerDocument;
  const iframe = ownerDocument.createElement("iframe");
  iframe.setAttribute("title", title);
  iframe.setAttribute("sandbox", sandbox);
  iframe.style.width = "100%";
  iframe.style.border = "0";
  iframe.style.display = "block";
  iframe.style.background = "transparent";
  iframe.style.height = `${minHeight}px`;
  const html = input.adapter
    ? injectScriptIntoHtml(rawHtml, buildChildBridgeScript())
    : rawHtml;
  iframe.srcdoc = html;

  let resizeObserver: ResizeObserver | undefined;
  let mutationObserver: MutationObserver | undefined;
  let parentBridge: ParentIframeBridge | undefined;

  const cleanupObservers = () => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = undefined;
    }
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = undefined;
    }
  };

  const handleLoad = () => {
    attachParentBridge();
    try {
      const doc = iframe.contentDocument;
      if (!doc) return;

      // Bundled-HTML CSS scopes most rules under .mtg-fragment-root.
      // Apply that class to the body so hover/transition/state rules match.
      if (doc.body && !doc.body.classList.contains(FRAGMENT_ROOT_CLASS)) {
        doc.body.classList.add(FRAGMENT_ROOT_CLASS);
      }

      const measure = () => {
        const next = Math.max(
          doc.documentElement?.scrollHeight ?? 0,
          doc.body?.scrollHeight ?? 0,
          minHeight,
        );
        iframe.style.height = `${next}px`;
        if (onResize) onResize(next);
      };
      measure();

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(measure);
        if (doc.documentElement) resizeObserver.observe(doc.documentElement);
        if (doc.body) resizeObserver.observe(doc.body);
      }

      // Catch dynamic DOM changes from inline scripts (telemetry beacons,
      // chart hydration, etc.) that the ResizeObserver may miss on attribute
      // changes that don't trigger a layout shift on its observed roots.
      if (typeof MutationObserver !== "undefined" && doc.body) {
        mutationObserver = new MutationObserver(() => measure());
        mutationObserver.observe(doc.body, {
          childList: true,
          subtree: true,
          attributes: false,
          characterData: false,
        });
      }
    } catch {
      // Cross-origin or torn-down document — observers can't attach.
    }
  };

  const attachParentBridge = () => {
    if (!input.adapter || parentBridge || !iframe.contentWindow) return;
    parentBridge = createParentIframeBridge({
      adapter: input.adapter,
      targetWindow: iframe.contentWindow,
      context: input.context,
      onCapabilityError: input.onCapabilityError,
      targetOrigin: input.targetOrigin,
    });
  };

  iframe.addEventListener("load", handleLoad);
  attachParentBridge();

  // Replace any previous mount in the host.
  host.replaceChildren(iframe);

  return () => {
    iframe.removeEventListener("load", handleLoad);
    cleanupObservers();
    parentBridge?.detach();
    parentBridge = undefined;
    if (iframe.parentNode === host) host.removeChild(iframe);
  };
}

export function isFullHtmlDocument(html: string): boolean {
  return /^\s*(?:<!DOCTYPE html>|<html\b)/i.test(html);
}

function injectScriptIntoHtml(html: string, scriptSource: string): string {
  const tag = `<script>${scriptSource}</script>`;
  const headCloseIndex = html.search(/<\/head\s*>/i);
  if (headCloseIndex >= 0) {
    return `${html.slice(0, headCloseIndex)}${tag}${html.slice(headCloseIndex)}`;
  }
  const bodyOpenMatch = /<body(?:\s[^>]*)?>/i.exec(html);
  if (bodyOpenMatch?.index !== undefined) {
    const insertIndex = bodyOpenMatch.index + bodyOpenMatch[0].length;
    return `${html.slice(0, insertIndex)}${tag}${html.slice(insertIndex)}`;
  }
  return `${tag}${html}`;
}
