import { afterEach, describe, expect, it, vi } from "vitest";
import { createMontageAdapter } from "./agent-adapter";
import {
  installCapabilityBridge,
  uninstallCapabilityBridge,
} from "./capability-bridge-runtime";

type TestGlobal = typeof globalThis & {
  MontageAOT?: {
    invoke(call: {
      name: string;
      source?: string;
      effect: "pure" | "query" | "effect";
      args?: unknown;
      context?: unknown;
    }): unknown;
  };
};

describe("capability-bridge-runtime — SDK mode", () => {
  afterEach(() => {
    uninstallCapabilityBridge();
  });

  it("installCapabilityBridge attaches MontageAOT.invoke to globalThis", () => {
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
      invokeCapability: async () => ({ rows: [{ id: 1 }] }),
    });

    installCapabilityBridge({ mode: "sdk", adapter });

    const aot = (globalThis as TestGlobal).MontageAOT;
    expect(aot).toBeDefined();
    expect(typeof aot?.invoke).toBe("function");
  });

  it("invoke routes to MontageAdapter.invokeCapability and returns the result", async () => {
    const invokeCapability = vi.fn(async () => ({ rows: [{ id: 1 }] }));
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
      invokeCapability,
    });

    installCapabilityBridge({
      mode: "sdk",
      adapter,
      context: { tenantId: "t1" },
    });

    const aot = (globalThis as TestGlobal).MontageAOT;
    const result = await aot?.invoke({
      name: "fetchUsers",
      effect: "query",
      args: { limit: 10 },
    });

    expect(invokeCapability).toHaveBeenCalledWith({
      name: "fetchUsers",
      source: "fetchUsers",
      effect: "query",
      args: { limit: 10 },
      context: { tenantId: "t1" },
    });
    expect(result).toEqual({ rows: [{ id: 1 }] });
  });

  it("invoke calls onCapabilityError when adapter throws", async () => {
    const onCapabilityError = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const adapter = createMontageAdapter({
      agent: { id: "a", name: "Agent A" },
      capabilities: [
        {
          name: "boom",
          effect: "effect",
          description: "Throws.",
          availability: "adapter",
        },
      ],
      invokeCapability: async () => {
        throw new Error("kaboom");
      },
    });

    installCapabilityBridge({
      mode: "sdk",
      adapter,
      onCapabilityError,
    });

    const aot = (globalThis as TestGlobal).MontageAOT;
    await expect(aot?.invoke({
      name: "boom",
      effect: "effect",
      args: {},
      context: {},
    })).rejects.toThrow("kaboom");

    expect(onCapabilityError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "kaboom" }),
      expect.objectContaining({
        request: expect.objectContaining({ name: "boom" }),
      }),
    );
    consoleError.mockRestore();
  });

  it("uninstallCapabilityBridge restores a previous MontageAOT host", () => {
    const previousHost = {
      invoke: vi.fn(() => "previous"),
    };
    (globalThis as TestGlobal).MontageAOT = previousHost;
    const adapter = createMontageAdapter({
      agent: { id: "a", name: "Agent A" },
    });

    installCapabilityBridge({ mode: "sdk", adapter });
    uninstallCapabilityBridge();

    expect((globalThis as TestGlobal).MontageAOT).toBe(previousHost);
  });
});

describe("capability-bridge-runtime — hosted mode", () => {
  afterEach(() => {
    uninstallCapabilityBridge();
  });

  it("hosted mode resolves direct binding via fetch to the configured URL", async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({ rows: [1] }),
    }));
    vi.stubGlobal("fetch", fetchSpy);
    installCapabilityBridge({
      mode: "hosted",
      bindingManifest: {
        bindings: {
          fetchUsers: { mode: "direct", effect: "query", url: "https://api.acme.com/users" },
        },
        corsOrigins: [],
        updatedAt: "",
      },
      artifactId: "a1",
      proxyBaseUrl: "https://montage.app",
      runtimeContext: { subject: "endUser_42" },
    });
    const aot = (globalThis as TestGlobal).MontageAOT;
    const result = await aot?.invoke({
      name: "fetchUsers",
      effect: "query",
      args: { limit: 5 },
      context: {},
    });
    expect(result).toEqual({ rows: [1] });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.acme.com/users",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("endUser_42"),
      }),
    );
  });

  it("hosted mode resolves proxy binding through Montage proxy", async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true }),
    }));
    vi.stubGlobal("fetch", fetchSpy);
    installCapabilityBridge({
      mode: "hosted",
      bindingManifest: {
        bindings: {
          addNote: { mode: "proxy", effect: "effect" },
        },
        corsOrigins: [],
        updatedAt: "",
      },
      artifactId: "a1",
      proxyBaseUrl: "https://montage.app",
      runtimeContext: { subject: "endUser_42" },
    });
    const aot = (globalThis as TestGlobal).MontageAOT;
    await aot?.invoke({ name: "addNote", effect: "effect", args: { body: "hi" } });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://montage.app/v1/proxy/a1/addNote",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ args: { body: "hi" } }),
      }),
    );
  });

  it("hosted mode rejects when capability has no binding", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    installCapabilityBridge({
      mode: "hosted",
      bindingManifest: { bindings: {}, corsOrigins: [], updatedAt: "" },
      artifactId: "a1",
      proxyBaseUrl: "https://montage.app",
      runtimeContext: { subject: "u" },
    });
    const aot = (globalThis as TestGlobal).MontageAOT;
    await expect(aot?.invoke({
      name: "missing",
      effect: "query",
      args: {},
      context: {},
    })).rejects.toThrow(/no binding/i);
    consoleError.mockRestore();
  });
});
