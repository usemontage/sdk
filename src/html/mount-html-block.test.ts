// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMontageAdapter } from "../agent-adapter";
import { uninstallCapabilityBridge } from "../capability-bridge-runtime";
import { HtmlBlock } from "../react/HtmlBlock";
import { IFRAME_BRIDGE_PROTOCOL } from "./iframe-bridge";
import { mountHtmlBlock } from "./mount-html-block";
import { mountShadowBlock } from "./mount-shadow-block";

const agent = {
  id: "agent-sdk",
  name: "SDK Agent",
};

type TestGlobal = typeof globalThis & {
  MontageAOT?: unknown;
};

type TestWindow = Window & typeof globalThis & {
  MontageAOT?: unknown;
};

(globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
}).IS_REACT_ACT_ENVIRONMENT = true;

async function tick(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("mountHtmlBlock", () => {
  afterEach(() => {
    uninstallCapabilityBridge();
  });

  it("mounts a bundled HTML document into a host element and runs its inline scripts", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const cleanup = mountHtmlBlock({
      host,
      html: `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Artifact</title>
    <style>#counter { color: rgb(1, 2, 3); }</style>
  </head>
  <body>
    <button id="counter">0</button>
    <script>
      document.getElementById("counter").textContent = "1";
      document.body.setAttribute("data-artifact-script-ran", "true");
    </script>
  </body>
</html>`,
    });

    await tick();

    expect(host.querySelector("style")?.textContent).toContain("#counter");
    expect(host.querySelector("#counter")?.textContent).toBe("1");
    expect(document.body.dataset.artifactScriptRan).toBe("true");

    cleanup();
    expect(host.innerHTML).toBe("");
    host.remove();
    document.body.removeAttribute("data-artifact-script-ran");
  });

  it("installs the capability bridge before artifact scripts run", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const invokeCapability = vi.fn(() => ({ subject: "Board packet" }));
    const adapter = createMontageAdapter({
      agent,
      capabilities: [
        {
          name: "fetchEmails",
          effect: "query",
          description: "Fetch email summaries.",
          availability: "adapter",
        },
      ],
      invokeCapability,
    });

    const cleanup = mountHtmlBlock({
      host,
      adapter,
      html: `
        <output id="capability-result"></output>
        <script>
          Promise.resolve(globalThis.MontageAOT.invoke({
            name: "fetchEmails",
            effect: "query",
            args: [{ userId: "user-1" }]
          })).then((result) => {
            document.getElementById("capability-result").textContent = result.subject;
          });
        </script>
      `,
    });

    await tick();

    expect(invokeCapability).toHaveBeenCalledWith({
      name: "fetchEmails",
      source: "fetchEmails",
      effect: "query",
      args: [{ userId: "user-1" }],
      context: undefined,
    });
    expect(host.querySelector("#capability-result")?.textContent).toBe("Board packet");

    cleanup();
    expect((globalThis as TestGlobal).MontageAOT).toBeUndefined();
    expect((window as TestWindow).MontageAOT).toBeUndefined();
    host.remove();
  });

  it("does not install MontageAOT.invoke when adapter is omitted", () => {
    const host = document.createElement("div");

    const cleanup = mountHtmlBlock({
      host,
      html: "<div>static</div>",
    });

    expect((globalThis as TestGlobal).MontageAOT).toBeUndefined();
    cleanup();
  });
});

describe("mountShadowBlock", () => {
  afterEach(() => {
    uninstallCapabilityBridge();
  });

  it("installs MontageAOT.invoke before scoped shadow scripts run", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const invokeCapability = vi.fn(async () => ({ subject: "Shadow packet" }));
    const adapter = createMontageAdapter({
      agent,
      capabilities: [
        {
          name: "fetchEmails",
          effect: "query",
          description: "Fetch email summaries.",
          availability: "adapter",
        },
      ],
      invokeCapability,
    });

    const cleanup = mountShadowBlock({
      host,
      fragment: `<output id="capability-result"></output>`,
      adapter,
      scripts: [
        `
          Promise.resolve(globalThis.MontageAOT.invoke({
            name: "fetchEmails",
            effect: "query",
            args: []
          })).then((result) => {
            host.setAttribute("data-capability-result", result.subject);
          });
        `,
      ],
    });

    await tick();

    expect(invokeCapability).toHaveBeenCalledWith({
      name: "fetchEmails",
      source: "fetchEmails",
      effect: "query",
      args: [],
      context: undefined,
    });
    expect(host.dataset.capabilityResult).toBe("Shadow packet");

    cleanup();
    host.remove();
  });
});

describe("HtmlBlock React adapter prop", () => {
  afterEach(() => {
    uninstallCapabilityBridge();
  });

  it("forwards adapter into iframe mounts for full HTML documents", async () => {
    const adapter = createMontageAdapter({
      agent,
      capabilities: [
        {
          name: "fetchEmails",
          effect: "query",
          description: "Fetch email summaries.",
          availability: "adapter",
        },
      ],
      invokeCapability: async () => ({ subject: "Board packet" }),
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    let root: Root | undefined;

    await act(async () => {
      root = createRoot(container);
      root.render(React.createElement(HtmlBlock, {
        html: "<!DOCTYPE html><html><head></head><body><main>Artifact</main></body></html>",
        adapter,
        mode: "html",
      }));
    });

    const iframe = container.querySelector("iframe");
    expect(iframe?.srcdoc).toContain(IFRAME_BRIDGE_PROTOCOL);

    await act(async () => {
      root?.unmount();
    });
    container.remove();
  });
});
