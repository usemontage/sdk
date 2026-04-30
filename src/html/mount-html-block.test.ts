// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { createMontageAdapter } from "../agent-adapter";
import { mountHtmlBlock } from "./mount-html-block";

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

async function tick(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("mountHtmlBlock", () => {
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
});
