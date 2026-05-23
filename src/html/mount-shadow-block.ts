/**
 * Mount a Montage fragment inside a Shadow DOM root for style isolation.
 *
 * Intended for SDK consumers who receive fragment output from the API and
 * want basic encapsulated rendering.
 */

import type {
  MontageAdapter,
  MontageAgentDescriptor,
} from "../agent-adapter";
import type { MontageCapabilityBridgeErrorContext } from "../capability-bridge";
import { installCapabilityBridge } from "../capability-bridge-runtime";
import type { MontageError } from "../errors";

export interface MountedShadowBlockOptions<
  TAgent extends MontageAgentDescriptor = MontageAgentDescriptor,
> {
  /** Host element to attach the shadow root to. */
  host: HTMLElement;
  /** HTML fragment markup (no wrapping document). */
  fragment: string;
  /** Optional CSS string injected as a `<style>` element. */
  styles?: string;
  /** Optional external stylesheet hrefs injected as `<link>` elements. */
  stylesheets?: string[];
  /** Optional raw JS source strings executed in a scoped context. */
  scripts?: string[];
  /** Optional external script URLs loaded into document.head before inline scripts run. */
  externalScripts?: string[];
  /** Capability adapter installed as `MontageAOT.invoke` before scripts run. */
  adapter?: MontageAdapter<TAgent>;
  /** Context passed into adapter capability invocations. */
  context?: unknown;
  onCapabilityError?: (
    error: MontageError,
    context: MontageCapabilityBridgeErrorContext,
  ) => void;
}

export function mountShadowBlock<
  TAgent extends MontageAgentDescriptor = MontageAgentDescriptor,
>(input: MountedShadowBlockOptions<TAgent>): () => void {
  const { host, fragment, styles, stylesheets, scripts, externalScripts } = input;

  const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  const cleanupBridge = input.adapter
    ? installCapabilityBridge({
        mode: "sdk",
        adapter: input.adapter,
        context: input.context,
        root,
        onCapabilityError: input.onCapabilityError,
      })
    : () => {};

  // Clear any previous content.
  root.replaceChildren();

  // Inject external stylesheets into both the shadow root (for CSS rules)
  // and the document head (for @font-face registration — fonts declared
  // inside shadow DOM don't always register with the global font registry).
  if (stylesheets) {
    for (const href of stylesheets) {
      const shadowLink = document.createElement("link");
      shadowLink.rel = "stylesheet";
      shadowLink.href = href;
      root.appendChild(shadowLink);

      if (!document.head.querySelector(`link[href="${CSS.escape(href)}"]`)) {
        const docLink = document.createElement("link");
        docLink.rel = "stylesheet";
        docLink.href = href;
        docLink.setAttribute("data-mtg-shadow-font", "true");
        document.head.appendChild(docLink);
      }
    }
  }

  // Inject inline styles — rewrite document-level selectors so they apply
  // inside the shadow tree instead of targeting the outer document.
  if (styles) {
    const style = document.createElement("style");
    style.textContent = adaptCssForShadowDom(styles);
    root.appendChild(style);
  }

  // Create the fragment container.
  const container = document.createElement("div");
  container.className = "mtg-fragment-root";
  container.innerHTML = fragment;
  root.appendChild(container);

  // Auto-install chart tooltip hover behavior when the fragment contains
  // data-mtg-tooltip marks (emitted by atlas chart section renderers).
  if (fragment.includes("data-mtg-tooltip")) {
    installShadowTooltips(root, container);
  }

  function runInlineScripts(): void {
    if (!scripts) return;
    for (const src of scripts) {
      try {
        new Function("shadowRoot", "host", src)(root, host);
      } catch {
        // Script execution errors are silently swallowed to avoid
        // breaking the mount. Consumers should handle errors in
        // their own script code.
      }
    }
  }

  // Load external scripts into document.head (deduped), then run inline scripts.
  const needed = (externalScripts ?? []).filter(
    (src) => !document.querySelector(`script[src="${CSS.escape(src)}"]`),
  );

  if (needed.length > 0) {
    let remaining = needed.length;
    const onReady = () => { if (--remaining <= 0) runInlineScripts(); };
    for (const src of needed) {
      const el = document.createElement("script");
      el.src = src;
      el.setAttribute("data-mtg-external", "true");
      el.onload = onReady;
      el.onerror = onReady;
      document.head.appendChild(el);
    }
  } else {
    runInlineScripts();
  }

  return () => {
    cleanupBridge();
    root.replaceChildren();
  };
}

function installShadowTooltips(root: ShadowRoot, container: HTMLElement): void {
  const tipCss = document.createElement("style");
  tipCss.textContent = [
    "[data-mtg-tooltip] { transition: opacity 180ms ease, filter 180ms ease; cursor: crosshair; }",
    "[data-mtg-tooltip]:hover { filter: drop-shadow(0 8px 12px rgba(15,23,42,.18)); opacity: .9; }",
  ].join("\n");
  root.insertBefore(tipCss, container);

  let tip: HTMLDivElement | null = null;
  function ensureTip(): HTMLDivElement {
    if (tip) return tip;
    tip = document.createElement("div");
    tip.setAttribute("role", "status");
    tip.style.cssText =
      "position:fixed;left:0;top:0;z-index:2147483646;pointer-events:none;opacity:0;" +
      "transform:translate3d(0,0,0) scale(.98);transition:opacity 120ms ease,transform 120ms ease;" +
      "padding:7px 9px;border-radius:10px;background:rgba(17,24,39,.94);color:#fff;" +
      "font:700 12px/1.25 Inter,ui-sans-serif,system-ui,sans-serif;" +
      "box-shadow:0 16px 40px rgba(15,23,42,.22);max-width:260px;white-space:nowrap";
    document.body.appendChild(tip);
    return tip;
  }
  root.addEventListener("pointerover", (e: Event) => {
    const pe = e as PointerEvent;
    const target = (pe.target as Element)?.closest?.("[data-mtg-tooltip]");
    if (!target) return;
    const text = target.getAttribute("data-mtg-tooltip");
    if (!text) return;
    const el = ensureTip();
    el.textContent = text;
    const x = pe.clientX || 0;
    const y = pe.clientY || 0;
    el.style.transform = `translate3d(${Math.min(Math.max(8, x + 14), window.innerWidth - 200)}px,${Math.max(8, y - 40)}px,0) scale(1)`;
    el.style.opacity = "1";
  });
  root.addEventListener("pointerout", (e: Event) => {
    const pe = e as PointerEvent;
    const target = (pe.target as Element)?.closest?.("[data-mtg-tooltip]");
    if (target && tip) tip.style.opacity = "0";
  });
}

function adaptCssForShadowDom(css: string): string {
  return css
    .replace(/:root/g, ":host")
    .replace(/(?:html\s*,\s*body|body\s*,\s*html)\s*\{/g, ":host{")
    .replace(/(?<![.\-\w])body\s*\{/g, ":host{");
}
