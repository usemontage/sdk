import React, { useCallback, useEffect, useRef, useState } from "react";
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
import {
  renderSkeletonMarkup,
  type MontageBlockLayout,
} from "../skeleton/archetypes";

export type MontageBlockTransition = "crossfade" | "blur" | "scale" | "none";
export type MontageBlockState = "pending" | "ready" | "error";

export interface MontageBlockError {
  message: string;
  code?: string;
}

export interface MontageBlockProps<
  TAgent extends MontageAgentDescriptor = MontageAgentDescriptor,
> {
  html?: string;
  fragment?: string;
  styles?: string;
  stylesheets?: string[];
  scripts?: string[];
  externalScripts?: string[];

  layout?: MontageBlockLayout;
  loading?: boolean;
  error?: MontageBlockError | null;

  transition?: MontageBlockTransition;
  transitionMs?: number;
  minSkeletonMs?: number;

  mode?: "html" | "fragment" | "all";
  sandbox?: string;
  title?: string;
  minHeight?: number;
  autoResize?: boolean;
  onResize?: (heightPx: number) => void;

  adapter?: MontageAdapter<TAgent>;
  context?: unknown;
  onCapabilityError?: (
    error: MontageError,
    context: MontageCapabilityBridgeErrorContext,
  ) => void;

  onReady?: () => void;
  onStateChange?: (state: MontageBlockState) => void;

  className?: string;
  style?: React.CSSProperties;
}

function hasContent(props: MontageBlockProps): boolean {
  return props.html != null || props.fragment != null;
}

function deriveState(props: MontageBlockProps): MontageBlockState {
  if (props.error) return "error";
  if (props.loading === true || !hasContent(props)) return "pending";
  return "ready";
}

const TRANSITION_CSS: Record<MontageBlockTransition, { enter: string; exit: string }> = {
  crossfade: {
    enter: "opacity:0",
    exit: "opacity:0",
  },
  blur: {
    enter: "opacity:0;filter:blur(8px)",
    exit: "opacity:0;filter:blur(8px)",
  },
  scale: {
    enter: "opacity:0;transform:scale(0.97)",
    exit: "opacity:0;transform:scale(1.02)",
  },
  none: { enter: "", exit: "" },
};

export function MontageBlock<
  TAgent extends MontageAgentDescriptor = MontageAgentDescriptor,
>(props: MontageBlockProps<TAgent>): React.ReactElement {
  const {
    layout = "card",
    transition = "crossfade",
    transitionMs = 320,
    minSkeletonMs = 300,
  } = props;

  const hostRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const skeletonShownAt = useRef<number>(0);
  const prevState = useRef<MontageBlockState>("pending");
  const [phase, setPhase] = useState<"skeleton" | "transitioning" | "content">("skeleton");

  const state = deriveState(props);

  useEffect(() => {
    if (state !== prevState.current) {
      prevState.current = state;
      props.onStateChange?.(state);
    }
  }, [state]);

  useEffect(() => {
    if (state === "pending") {
      skeletonShownAt.current = Date.now();
      setPhase("skeleton");
    }
  }, [state]);

  useEffect(() => {
    if (state !== "ready") return;

    const elapsed = Date.now() - skeletonShownAt.current;
    const remaining = Math.max(0, minSkeletonMs - elapsed);

    if (transition === "none" || remaining <= 0) {
      setPhase(transition === "none" ? "content" : "transitioning");
    } else {
      const timer = setTimeout(() => setPhase("transitioning"), remaining);
      return () => clearTimeout(timer);
    }
  }, [state, transition, minSkeletonMs]);

  useEffect(() => {
    if (phase !== "transitioning") return;
    const timer = setTimeout(() => {
      setPhase("content");
      props.onReady?.();
    }, transitionMs);
    return () => clearTimeout(timer);
  }, [phase, transitionMs]);

  const mountContent = useCallback(() => {
    if (!contentRef.current) return;

    const useShadow =
      props.mode === "fragment"
      || (props.mode === "all" && props.fragment != null)
      || (props.mode == null && props.fragment != null);

    if (useShadow) {
      return mountShadowBlock({
        host: contentRef.current,
        fragment: props.fragment ?? "",
        ...(props.styles ? { styles: props.styles } : {}),
        ...(props.stylesheets ? { stylesheets: props.stylesheets } : {}),
        ...(props.scripts ? { scripts: props.scripts } : {}),
        ...(props.externalScripts ? { externalScripts: props.externalScripts } : {}),
        adapter: props.adapter,
        context: props.context,
        onCapabilityError: props.onCapabilityError,
      });
    }

    const html = props.html ?? "";
    const useIframe =
      props.mode === "html"
      || props.mode === "all"
      || (props.mode == null && isFullHtmlDocument(html));

    if (useIframe) {
      return mountIframeHtmlBlock({
        host: contentRef.current,
        html,
        ...(props.sandbox ? { sandbox: props.sandbox } : {}),
        ...(props.title ? { title: props.title } : {}),
        ...(typeof props.minHeight === "number" ? { minHeight: props.minHeight } : {}),
        ...(typeof props.autoResize === "boolean" ? { autoResize: props.autoResize } : {}),
        ...(props.onResize ? { onResize: props.onResize } : {}),
        adapter: props.adapter,
        context: props.context,
        onCapabilityError: props.onCapabilityError,
      });
    }

    return mountHtmlBlock({
      host: contentRef.current,
      html,
      adapter: props.adapter,
      context: props.context,
      onCapabilityError: props.onCapabilityError,
    });
  }, [
    props.html, props.fragment, props.styles, props.stylesheets,
    props.scripts, props.externalScripts, props.adapter, props.context, props.onCapabilityError,
    props.mode, props.sandbox, props.title, props.minHeight, props.onResize,
  ]);

  useEffect(() => {
    if (state !== "ready") return;
    return mountContent();
  }, [state, mountContent]);

  const showSkeleton = phase === "skeleton" || phase === "transitioning";
  const showContent = phase === "transitioning" || phase === "content";

  const skeletonHtml = React.useMemo(() => renderSkeletonMarkup(layout), [layout]);
  const easing = `${transitionMs}ms cubic-bezier(0.4, 0, 0.2, 1)`;
  const tx = TRANSITION_CSS[transition];

  return (
    <div
      ref={hostRef}
      className={props.className}
      style={{
        display: "grid",
        gridTemplateAreas: "'stack'",
        ...props.style,
      }}
    >
      {showSkeleton && (
        <div
          dangerouslySetInnerHTML={{ __html: skeletonHtml }}
          style={{
            gridArea: "stack",
            transition: transition !== "none" ? `opacity ${easing}, filter ${easing}, transform ${easing}` : undefined,
            ...(phase === "transitioning" ? parseCss(tx.exit) : {}),
          }}
        />
      )}
      {hasContent(props) && (
        <div
          ref={contentRef}
          style={{
            gridArea: "stack",
            transition: transition !== "none" ? `opacity ${easing}, filter ${easing}, transform ${easing}` : undefined,
            ...(!showContent ? { opacity: 0, pointerEvents: "none" as const, position: "absolute" as const, visibility: "hidden" as const } : {}),
            ...(phase === "transitioning" ? parseCss(tx.enter) : {}),
            ...(phase === "content" ? { opacity: 1, filter: "none", transform: "none" } : {}),
          }}
        />
      )}
      {state === "error" && props.error && (
        <div
          style={{
            gridArea: "stack",
            padding: 16,
            color: "var(--mtg-color-danger, #dc2626)",
            fontSize: 14,
          }}
        >
          {props.error.message}
        </div>
      )}
    </div>
  );
}

function parseCss(inline: string): React.CSSProperties {
  if (!inline) return {};
  const style: Record<string, string> = {};
  for (const part of inline.split(";")) {
    const colon = part.indexOf(":");
    if (colon < 0) continue;
    const key = part.slice(0, colon).trim();
    const value = part.slice(colon + 1).trim();
    style[key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = value;
  }
  return style as React.CSSProperties;
}
