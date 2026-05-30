// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { createMontageAdapter } from "./agent-adapter";
import { bindMontageCapabilityBridge } from "./capability-bridge";
import type { ArtifactRef } from "./types";

type TestArtifactHost = {
  invoke(request: {
    name: string;
    source: string;
    effect: "pure" | "query" | "effect";
    args: unknown;
  }): unknown;
};

type TestGlobal = typeof globalThis & {
  MontageAOT?: TestArtifactHost;
};

const companyAgent = {
  id: "agent-x",
  name: "Agent X",
};

function getHost(): TestArtifactHost {
  const host = (globalThis as TestGlobal).MontageAOT;
  if (!host) throw new Error("Expected artifact host to be installed.");
  return host;
}

describe("bindMontageCapabilityBridge", () => {
  it("resolves adapter capabilities through MontageAOT.invoke", async () => {
    const adapter = createMontageAdapter({
      agent: companyAgent,
      capabilities: [
        {
          name: "artifact.pdf.render",
          effect: "effect",
          description: "Host-backed PDF rendering.",
          availability: "adapter",
        },
      ],
      async invokeCapability() {
        return {
          id: "pdf_1",
          kind: "pdf",
          name: "Lead.pdf",
          mimeType: "application/pdf",
        } satisfies ArtifactRef;
      },
    });

    const cleanup = bindMontageCapabilityBridge({ root: document, adapter });
    const host = getHost();

    const pdf = await host.invoke({
      name: "artifact.pdf.render",
      source: "artifact.pdf.render",
      effect: "effect",
      args: [{ title: "Lead" }],
    });
    cleanup();

    expect(pdf).toMatchObject({ id: "pdf_1", kind: "pdf" });
  });

  it("preserves object args and emits capability lifecycle events", async () => {
    const onEvent = vi.fn();
    const domEvents: unknown[] = [];
    document.addEventListener("montage:capability", (event) => {
      domEvents.push((event as CustomEvent).detail);
    });
    const invokeCapability = vi.fn(async (request) => ({
      rows: [{ id: 1, company: "Meridian Health" }],
      receivedArgs: request.args,
    }));
    const adapter = createMontageAdapter({
      agent: companyAgent,
      capabilities: [
        {
          name: "startup_data_query",
          effect: "query",
          description: "Fetch workspace data.",
          availability: "adapter",
        },
      ],
      invokeCapability,
    });

    const cleanup = bindMontageCapabilityBridge({
      root: document,
      adapter,
      onEvent,
    });
    const host = getHost();
    const result = await host.invoke({
      name: "startup_data_query",
      source: "startup_data_query",
      effect: "query",
      args: { category: "pipeline" },
    });
    cleanup();

    expect(invokeCapability).toHaveBeenCalledWith(
      expect.objectContaining({
        args: { category: "pipeline" },
      }),
    );
    expect(result).toMatchObject({
      rows: [{ id: 1, company: "Meridian Health" }],
      receivedArgs: { category: "pipeline" },
    });
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "start",
        request: expect.objectContaining({
          name: "startup_data_query",
          args: { category: "pipeline" },
        }),
      }),
    );
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "success",
        request: expect.objectContaining({ name: "startup_data_query" }),
        result: expect.objectContaining({
          rows: [{ id: 1, company: "Meridian Health" }],
        }),
      }),
    );
    expect(domEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ phase: "start" }),
        expect.objectContaining({ phase: "success" }),
      ]),
    );
  });

  it("fills missing capability args from visible fields in the mounted root", async () => {
    const root = document.createElement("section");
    root.innerHTML = '<label>Note<textarea name="note"></textarea></label>';
    const note = root.querySelector("textarea");
    if (!note) throw new Error("missing test note field");
    note.value = "Typed note from the generated UI";
    const invokeCapability = vi.fn(async (request) => ({
      ok: true,
      receivedArgs: request.args,
    }));
    const adapter = createMontageAdapter({
      agent: companyAgent,
      capabilities: [
        {
          name: "file_add",
          effect: "query",
          description: "Attach a note.",
          availability: "adapter",
        },
      ],
      invokeCapability,
    });

    const cleanup = bindMontageCapabilityBridge({ root, adapter });
    const result = await getHost().invoke({
      name: "file_add",
      source: "file_add",
      effect: "query",
      args: { entityType: "pipeline", entityId: "deal-001", note: "" },
    });
    cleanup();

    expect(invokeCapability).toHaveBeenCalledWith(
      expect.objectContaining({
        args: {
          entityType: "pipeline",
          entityId: "deal-001",
          note: "Typed note from the generated UI",
        },
      }),
    );
    expect(result).toMatchObject({
      receivedArgs: {
        note: "Typed note from the generated UI",
      },
    });
  });

  it("does not let empty generated fields overwrite a visible typed capability arg", async () => {
    const root = document.createElement("section");
    root.innerHTML = `
      <label>Quick note<input name="note" /></label>
      <label>Note<textarea name="note"></textarea></label>
    `;
    const quickNote = root.querySelector("input");
    if (!quickNote) throw new Error("missing quick note field");
    quickNote.value = "Typed note from the generated UI";
    const invokeCapability = vi.fn(async (request) => ({
      ok: true,
      receivedArgs: request.args,
    }));
    const adapter = createMontageAdapter({
      agent: companyAgent,
      capabilities: [
        {
          name: "file_add",
          effect: "query",
          description: "Attach a note.",
          availability: "adapter",
        },
      ],
      invokeCapability,
    });

    const cleanup = bindMontageCapabilityBridge({ root, adapter });
    await getHost().invoke({
      name: "file_add",
      source: "file_add",
      effect: "query",
      args: { entityType: "pipeline", entityId: "deal-001", note: "" },
    });
    cleanup();

    expect(invokeCapability).toHaveBeenCalledWith(
      expect.objectContaining({
        args: {
          entityType: "pipeline",
          entityId: "deal-001",
          note: "Typed note from the generated UI",
        },
      }),
    );
  });

  it("fills missing capability args from visible fields inside open shadow roots", async () => {
    const shadowHost = document.createElement("div");
    const shadow = shadowHost.attachShadow({ mode: "open" });
    shadow.innerHTML = '<label>Note<textarea name="note"></textarea></label>';
    const note = shadow.querySelector("textarea");
    if (!note) throw new Error("missing test note field");
    note.value = "Typed shadow note";
    document.body.appendChild(shadowHost);

    const invokeCapability = vi.fn(async (request) => ({
      ok: true,
      receivedArgs: request.args,
    }));
    const adapter = createMontageAdapter({
      agent: companyAgent,
      capabilities: [
        {
          name: "file_add",
          effect: "query",
          description: "Attach a note.",
          availability: "adapter",
        },
      ],
      invokeCapability,
    });

    const cleanup = bindMontageCapabilityBridge({ root: document, adapter });
    const result = await getHost().invoke({
      name: "file_add",
      source: "file_add",
      effect: "query",
      args: { entityType: "pipeline", entityId: "deal-001", note: "" },
    });
    cleanup();
    shadowHost.remove();

    expect(invokeCapability).toHaveBeenCalledWith(
      expect.objectContaining({
        args: {
          entityType: "pipeline",
          entityId: "deal-001",
          note: "Typed shadow note",
        },
      }),
    );
    expect(result).toMatchObject({
      receivedArgs: {
        note: "Typed shadow note",
      },
    });
  });

  it("canonicalizes generated capability effects to the registered adapter contract", async () => {
    const onEvent = vi.fn();
    const invokeCapability = vi.fn(async (request) => ({
      ok: true,
      effect: request.effect,
    }));
    const adapter = createMontageAdapter({
      agent: companyAgent,
      capabilities: [
        {
          name: "file_add",
          effect: "query",
          description: "Attach a note.",
          availability: "adapter",
        },
      ],
      invokeCapability,
    });

    const cleanup = bindMontageCapabilityBridge({ root: document, adapter, onEvent });
    const result = await getHost().invoke({
      name: "file_add",
      source: "file_add",
      effect: "effect",
      args: { note: "Pricing owner follow-up." },
    });
    cleanup();

    expect(result).toEqual({ ok: true, effect: "query" });
    expect(invokeCapability).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "file_add",
        effect: "query",
        args: { note: "Pricing owner follow-up." },
      }),
    );
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "start",
        request: expect.objectContaining({ name: "file_add", effect: "query" }),
      }),
    );
  });

  it("preserves an existing host MontageAOT.invoke as a fallback", async () => {
    const fallback = vi.fn(() => "fallback-result");
    (globalThis as TestGlobal).MontageAOT = { invoke: fallback };
    const adapter = createMontageAdapter({ agent: companyAgent });

    const cleanup = bindMontageCapabilityBridge({ root: document, adapter });
    const host = getHost();
    const result = host.invoke({
      name: "custom.unknown",
      source: "custom.unknown",
      effect: "query",
      args: [],
    });
    cleanup();

    expect(result).toBe("fallback-result");
    expect(fallback).toHaveBeenCalledOnce();
  });

  it("requires adapter-provided pure capabilities to return synchronously", () => {
    const adapter = createMontageAdapter({
      agent: companyAgent,
      capabilities: [
        {
          name: "adapter.ui.money",
          effect: "pure",
          description: "Format money.",
          availability: "adapter",
        },
      ],
      invokeCapability() {
        return Promise.resolve("$1,250");
      },
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const cleanup = bindMontageCapabilityBridge({ root: document, adapter });
    const host = getHost();
    expect(() => host.invoke({
      name: "adapter.ui.money",
      source: "adapter.ui.money",
      effect: "pure",
      args: [1250],
    })).toThrow("must return synchronously");
    cleanup();
    consoleError.mockRestore();
  });

  it("surfaces capability errors through diagnostics instead of silent no-ops", async () => {
    const onError = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const adapter = createMontageAdapter({
      agent: companyAgent,
      capabilities: [
        {
          name: "artifact.pdf.render",
          effect: "effect",
          description: "PDF rendering declared by the artifact.",
          availability: "declared",
        },
      ],
    });

    const cleanup = bindMontageCapabilityBridge({ root: document, adapter, onError });
    const host = getHost();
    expect(() => host.invoke({
      name: "artifact.pdf.render",
      source: "artifact.pdf.render",
      effect: "effect",
      args: [],
    })).toThrow("requires an adapter implementation");
    cleanup();

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "capability.unavailable" }),
      expect.objectContaining({ request: expect.objectContaining({ name: "artifact.pdf.render" }) }),
    );
    expect(consoleError).toHaveBeenCalledWith(expect.objectContaining({ code: "capability.unavailable" }));
    expect(document.querySelector("[data-montage-capability-error]")?.textContent)
      .toContain("artifact.pdf.render");
    consoleError.mockRestore();
  });
});
