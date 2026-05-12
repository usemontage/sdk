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

  // Inject inline styles.
  if (styles) {
    const style = document.createElement("style");
    style.textContent = styles;
    root.appendChild(style);
  }

  // Create the fragment container.
  const container = document.createElement("div");
  container.className = "mtg-fragment-root";
  container.innerHTML = fragment;
  root.appendChild(container);

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
