import React, { useEffect, useRef } from "react";
import type {
  MontageAdapter,
  MontageAgentDescriptor,
} from "../agent-adapter";
import type { MontageCapabilityBridgeErrorContext } from "../capability-bridge";
import type { MontageError } from "../errors";
import { mountHtmlBlock } from "../html/mount-html-block";
import {
  isFullHtmlDocument,
  mountIframeHtmlBlock,
} from "../html/mount-iframe-html-block";
import { mountShadowBlock } from "../html/mount-shadow-block";

export interface HtmlBlockProps<
  TAgent extends MontageAgentDescriptor = MontageAgentDescriptor,
> {
  /** HTML string. Full documents render in an iframe; fragments mount inline when mode is not specified. */
  html?: string;
  /**
   * Pre-separated HTML fragment body (no `<html>`/`<head>` wrappers).
   * When provided, the default mount strategy is shadow DOM.
   */
  fragment?: string;
  /** Scoped `<style>` content injected into the shadow root alongside the fragment. */
  styles?: string;
  /** External stylesheet URLs injected as `<link>` elements inside the shadow root. */
  stylesheets?: string[];
  /** External script URLs injected as `<script>` elements inside the shadow root. */
  scripts?: string[];
  /** Capability adapter for inline-mount calls. Ignored when iframe mode is used. */
  adapter?: MontageAdapter<TAgent>;
  /** Adapter context. Ignored in iframe mode. */
  context?: unknown;
  onCapabilityError?: (
    error: MontageError,
    context: MontageCapabilityBridgeErrorContext,
  ) => void;
  /**
   * Force a specific mount strategy.
   * - `"html"`: full document, iframe mounted with style isolation + auto-resize.
   * - `"fragment"`: separated parts, shadow DOM mounted inline for performance.
   * - `"all"`: prefers shadow mount from separated parts, falls back to iframe from html.
   *
   * When omitted the strategy is auto-detected:
   * - If `fragment` prop is provided -> shadow mount.
   * - If only `html` is provided -> `isFullHtmlDocument()` check: full docs -> iframe, fragments -> inline mount.
   */
  mode?: "html" | "fragment" | "all";
  /** Sandbox attributes when iframe mode is active. */
  sandbox?: string;
  /** Title attribute for the iframe (a11y). */
  title?: string;
  /** Minimum iframe height before content measures. */
  minHeight?: number;
  /** Called whenever iframe content height changes. */
  onResize?: (heightPx: number) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function HtmlBlock<
  TAgent extends MontageAgentDescriptor = MontageAgentDescriptor,
>(props: HtmlBlockProps<TAgent>): React.ReactElement {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mode = props.mode;

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    // --- shadow mount path ---
    const useShadow =
      mode === "fragment"
      || (mode === "all" && props.fragment != null)
      || (mode == null && props.fragment != null);

    if (useShadow) {
      return mountShadowBlock({
        host: hostRef.current,
        fragment: props.fragment ?? "",
        ...(props.styles ? { styles: props.styles } : {}),
        ...(props.stylesheets ? { stylesheets: props.stylesheets } : {}),
        ...(props.scripts ? { scripts: props.scripts } : {}),
        adapter: props.adapter,
        context: props.context,
        onCapabilityError: props.onCapabilityError,
      });
    }

    // --- iframe mount path ---
    const html = props.html ?? "";

    const useIframe =
      mode === "html"
      || mode === "all"
      || (mode == null && isFullHtmlDocument(html));

    if (useIframe) {
      return mountIframeHtmlBlock({
        host: hostRef.current,
        html,
        ...(props.sandbox ? { sandbox: props.sandbox } : {}),
        ...(props.title ? { title: props.title } : {}),
        ...(typeof props.minHeight === "number"
          ? { minHeight: props.minHeight }
          : {}),
        ...(props.onResize ? { onResize: props.onResize } : {}),
        adapter: props.adapter,
        context: props.context,
        onCapabilityError: props.onCapabilityError,
      });
    }

    // --- inline mount path (legacy default for html fragments) ---
    return mountHtmlBlock({
      host: hostRef.current,
      html,
      adapter: props.adapter,
      context: props.context,
      onCapabilityError: props.onCapabilityError,
    });
  }, [
    props.html,
    props.fragment,
    props.styles,
    props.stylesheets,
    props.scripts,
    props.adapter,
    props.context,
    props.onCapabilityError,
    mode,
    props.sandbox,
    props.title,
    props.minHeight,
    props.onResize,
  ]);

  return (
    <div
      ref={hostRef}
      className={props.className}
      style={props.style}
    />
  );
}
