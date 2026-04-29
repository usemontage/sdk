// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { createMontageAdapter } from "./agent-adapter";
import { bindMontageCapabilityBridge } from "./capability-bridge";
import type { ArtifactRef } from "./types";

const companyAgent = {
  id: "agent-x",
  name: "Agent X",
};

describe("bindMontageCapabilityBridge", () => {
  it("resolves built-in std capabilities and adapter overrides through MontageAOT.invoke", async () => {
    const adapter = createMontageAdapter({
      agent: companyAgent,
      capabilities: [
        {
          name: "std.artifact.pdf",
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
    const host = globalThis.MontageAOT as {
      invoke(request: {
        name: string;
        source: string;
        effect: "pure" | "query" | "effect";
        args: unknown[];
      }): unknown;
    };

    expect(host.invoke({
      name: "std.data.filter",
      source: "std.data.filter",
      effect: "pure",
      args: [[{ name: "Acme" }, { name: "Globex" }], { search: "glo", fields: ["name"] }],
    })).toEqual([{ name: "Globex" }]);

    const pdf = await host.invoke({
      name: "std.artifact.pdf",
      source: "std.artifact.pdf",
      effect: "effect",
      args: [{ title: "Lead" }],
    });
    cleanup();

    expect(pdf).toMatchObject({ id: "pdf_1", kind: "pdf" });
  });

  it("preserves an existing host MontageAOT.invoke as a fallback", async () => {
    const fallback = vi.fn(() => "fallback-result");
    globalThis.MontageAOT = { invoke: fallback };
    const adapter = createMontageAdapter({ agent: companyAgent });

    const cleanup = bindMontageCapabilityBridge({ root: document, adapter });
    const host = globalThis.MontageAOT as {
      invoke(request: {
        name: string;
        source: string;
        effect: "pure" | "query" | "effect";
        args: unknown[];
      }): unknown;
    };
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
    const host = globalThis.MontageAOT as {
      invoke(request: {
        name: string;
        source: string;
        effect: "pure" | "query" | "effect";
        args: unknown[];
      }): unknown;
    };
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
    const adapter = createMontageAdapter({ agent: companyAgent });

    const cleanup = bindMontageCapabilityBridge({ root: document, adapter, onError });
    const host = globalThis.MontageAOT as {
      invoke(request: {
        name: string;
        source: string;
        effect: "pure" | "query" | "effect";
        args: unknown[];
      }): unknown;
    };
    expect(() => host.invoke({
      name: "std.artifact.pdf",
      source: "std.artifact.pdf",
      effect: "effect",
      args: [],
    })).toThrow("requires an adapter implementation");
    cleanup();

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "capability.unavailable" }),
      expect.objectContaining({ request: expect.objectContaining({ name: "std.artifact.pdf" }) }),
    );
    expect(consoleError).toHaveBeenCalledWith(expect.objectContaining({ code: "capability.unavailable" }));
    expect(document.querySelector("[data-montage-capability-error]")?.textContent)
      .toContain("std.artifact.pdf");
    consoleError.mockRestore();
  });
});
