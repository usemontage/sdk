// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { createMontageStreamSurface } from "../tools";

afterEach(() => {
  document.body.innerHTML = "";
  delete (globalThis as Record<string, unknown>).__streamScriptRan;
});

describe("streaming preview with previewScripts: false", () => {
  it("does not execute artifact scripts in the host window", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const surface = createMontageStreamSurface(target, {
      previewScripts: false,
    });

    await surface.applyEvent({
      type: "slot",
      slot: "section-1",
      html: `<div>hello</div><script>globalThis.__streamScriptRan = true</script>`,
    } as never);

    expect((globalThis as Record<string, unknown>).__streamScriptRan).toBe(
      undefined,
    );
    // Declarative content still renders; the inert script is stripped.
    expect(target.textContent).toContain("hello");
    expect(target.querySelector("script")).toBeNull();
    surface.cleanup();
  });

  it("renders nested-iframe (d3/canvas) slots incrementally even with previewScripts:false", async () => {
    // d3/canvas apps stream as a nested <iframe srcdoc>; their scripts run
    // inside that iframe (already isolated from the host), so the preview must
    // still mount and incrementally update the iframe — title/controls appear
    // as they arrive — rather than waiting and showing a placeholder.
    const target = document.createElement("div");
    document.body.appendChild(target);
    const surface = createMontageStreamSurface(target, {
      previewScripts: false,
    });

    const iframeSlot = (body: string) => ({
      type: "slot",
      slot: "html-app",
      html: `<section class="mtg-html-app-stage"><iframe srcdoc="<html><body>${body}</body></html>"></iframe></section>`,
    });

    await surface.applyEvent(iframeSlot("<h1>Force graph</h1>") as never)
    const iframe = target.querySelector("iframe")
    expect(iframe).not.toBeNull()
    expect(iframe?.getAttribute("srcdoc")).toContain("Force graph")

    // A later, larger chunk updates the same slot in place (no duplicate iframe).
    await surface.applyEvent(
      iframeSlot("<h1>Force graph</h1><div>controls</div>") as never,
    )
    expect(target.querySelectorAll("[data-mtg-stream-slot]").length).toBe(1)
    surface.cleanup();
  });

  it("keeps an executable script node by default (previewScripts unset)", async () => {
    // jsdom does not execute replaceWith-inserted scripts, so we assert the
    // branch behavior: by default the script is mounted as an executable node
    // (not stripped, unlike the previewScripts:false path above).
    const target = document.createElement("div");
    document.body.appendChild(target);
    const surface = createMontageStreamSurface(target);

    await surface.applyEvent({
      type: "slot",
      slot: "section-1",
      html: `<div>hi</div><script>globalThis.__streamScriptRan = true</script>`,
    } as never);

    expect(target.querySelector("script")).not.toBeNull();
    surface.cleanup();
  });
});
