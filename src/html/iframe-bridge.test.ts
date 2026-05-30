// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { createMontageAdapter } from "../agent-adapter";
import {
  createParentIframeBridge,
  IFRAME_BRIDGE_PROTOCOL,
} from "./iframe-bridge";
import { mountIframeHtmlBlock } from "./mount-iframe-html-block";
import { installMontageAgentActionHandler } from "../agent-actions";

describe("iframe-bridge — parent side", () => {
  it("answers capability invoke messages from the iframe", async () => {
    const adapter = createMontageAdapter({
      agent: { id: "a", name: "Agent A" },
      capabilities: [
        {
          name: "fetchUsers",
          effect: "query",
          description: "Fetch users.",
          availability: "adapter",
        },
      ],
      invokeCapability: async () => ({ rows: [1] }),
    });
    const targetWindow = {
      postMessage: vi.fn(),
    } as unknown as Window;
    const bridge = createParentIframeBridge({ adapter, targetWindow });

    await bridge.handleMessage({
      data: {
        protocol: IFRAME_BRIDGE_PROTOCOL,
        kind: "invoke",
        callId: "c1",
        name: "fetchUsers",
        effect: "query",
        args: [],
      },
    } as MessageEvent);

    expect(targetWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        protocol: IFRAME_BRIDGE_PROTOCOL,
        kind: "result",
        callId: "c1",
        ok: true,
        value: { rows: [1] },
      }),
      expect.any(String),
    );
  });

  it("posts ok=false when adapter throws", async () => {
    const adapter = createMontageAdapter({
      agent: { id: "a", name: "Agent A" },
      capabilities: [
        {
          name: "x",
          effect: "effect",
          description: "Throws.",
          availability: "adapter",
        },
      ],
      invokeCapability: async () => {
        throw new Error("nope");
      },
    });
    const targetWindow = {
      postMessage: vi.fn(),
    } as unknown as Window;
    const bridge = createParentIframeBridge({ adapter, targetWindow });

    await bridge.handleMessage({
      data: {
        protocol: IFRAME_BRIDGE_PROTOCOL,
        kind: "invoke",
        callId: "c1",
        name: "x",
        effect: "effect",
        args: [],
      },
    } as MessageEvent);

    expect(targetWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        protocol: IFRAME_BRIDGE_PROTOCOL,
        kind: "result",
        callId: "c1",
        ok: false,
        error: "nope",
      }),
      expect.any(String),
    );
  });

  it("answers agent action messages from the iframe through the shared event contract", async () => {
    const targetWindow = {
      postMessage: vi.fn(),
    } as unknown as Window;
    const adapter = createMontageAdapter({
      agent: { id: "a", name: "Agent A" },
    });
    const agentTarget = new EventTarget();
    const uninstall = installMontageAgentActionHandler(agentTarget, async (request) => ({
      type: "artifact",
      artifactId: request.artifactId ?? "art_1",
      revisionId: "rev_2",
    }));
    const bridge = createParentIframeBridge({
      adapter,
      targetWindow,
      agentActionTarget: agentTarget,
    });

    await bridge.handleMessage({
      source: targetWindow,
      data: {
        protocol: IFRAME_BRIDGE_PROTOCOL,
        kind: "agent-action",
        callId: "agent1",
        request: {
          artifactId: "art_1",
          action: "patch_artifact",
          instruction: "Add a risk panel.",
        },
      },
    } as unknown as MessageEvent);

    uninstall();
    expect(targetWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        protocol: IFRAME_BRIDGE_PROTOCOL,
        kind: "result",
        callId: "agent1",
        ok: true,
        value: {
          type: "artifact",
          artifactId: "art_1",
          revisionId: "rev_2",
        },
      }),
      expect.any(String),
    );
  });

  it("injects the child agent bridge script when an iframe mount receives an adapter", () => {
    const adapter = createMontageAdapter({
      agent: { id: "a", name: "Agent A" },
    });
    const host = document.createElement("div");
    document.body.appendChild(host);

    const cleanup = mountIframeHtmlBlock({
      host,
      html: "<!DOCTYPE html><html><head></head><body><main>Artifact</main></body></html>",
      adapter,
    });

    const iframe = host.querySelector("iframe");
    expect(iframe?.srcdoc).toContain("agent-action");
    expect(iframe?.srcdoc).toContain("MontageAOT.agent");

    cleanup();
    host.remove();
  });

  it("injects the child bridge script when an iframe mount receives an adapter", () => {
    const adapter = createMontageAdapter({
      agent: { id: "a", name: "Agent A" },
    });
    const host = document.createElement("div");
    document.body.appendChild(host);

    const cleanup = mountIframeHtmlBlock({
      host,
      html: "<!DOCTYPE html><html><head></head><body><main>Artifact</main></body></html>",
      adapter,
    });

    const iframe = host.querySelector("iframe");
    expect(iframe?.srcdoc).toContain(IFRAME_BRIDGE_PROTOCOL);

    cleanup();
    host.remove();
  });

  it("allows generated artifacts to trigger browser downloads by default", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const cleanup = mountIframeHtmlBlock({
      host,
      html: "<!DOCTYPE html><html><body><main>Export</main></body></html>",
    });

    const iframe = host.querySelector("iframe");
    expect(iframe?.getAttribute("sandbox")).toContain("allow-downloads");

    cleanup();
    host.remove();
  });
});
