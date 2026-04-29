import React, { useEffect, useRef } from "react";
import type {
  MontageAdapter,
  MontageAgentDescriptor,
} from "../agent-adapter";
import type { MontageCapabilityBridgeErrorContext } from "../capability-bridge";
import type { MontageError } from "../errors";
import { mountHtmlBlock } from "../html/mount-html-block";

export interface HtmlBlockProps<
  TAgent extends MontageAgentDescriptor = MontageAgentDescriptor,
> {
  html: string;
  adapter?: MontageAdapter<TAgent>;
  context?: unknown;
  onCapabilityError?: (
    error: MontageError,
    context: MontageCapabilityBridgeErrorContext,
  ) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function HtmlBlock<
  TAgent extends MontageAgentDescriptor = MontageAgentDescriptor,
>(props: HtmlBlockProps<TAgent>): React.ReactElement {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }
    return mountHtmlBlock({
      host: hostRef.current,
      html: props.html,
      adapter: props.adapter,
      context: props.context,
      onCapabilityError: props.onCapabilityError,
    });
  }, [props.html, props.adapter, props.context, props.onCapabilityError]);

  return (
    <div
      ref={hostRef}
      className={props.className}
      style={props.style}
    />
  );
}
