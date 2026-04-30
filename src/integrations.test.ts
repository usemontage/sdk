import { describe, expect, it, vi } from "vitest";
import {
  createMontageAiSdkTool,
  createMontageVercelAiTool,
} from "./ai-sdk";
import * as integrations from "./integrations";
import { createMontageMastraTool } from "./mastra";
import type { MontageToolkit } from "./tools";

const chain = () => ({
  optional() {
    return this;
  },
  describe() {
    return this;
  },
});

const z = {
  object: vi.fn((shape: unknown) => ({ kind: "object", shape })),
  string: vi.fn(chain),
  enum: vi.fn((values: readonly string[]) => ({ ...chain(), values })),
  record: vi.fn(() => chain()),
  unknown: vi.fn(() => ({ kind: "unknown" })),
};

function createToolkit(): MontageToolkit {
  return {
    execute: vi.fn(async (input) => ({
      id: "gen_test",
      html: `<div>${input.prompt}</div>`,
      creditsUsed: 1,
    })),
    anthropic: vi.fn(() => []),
    openai: vi.fn(() => []),
  };
}

describe("framework integrations", () => {
  it("exposes Mastra-compatible tooling directly and through integrations", async () => {
    const toolkit = createToolkit();
    const direct = createMontageMastraTool(toolkit, z);
    const namespaced = integrations.mastra(toolkit, z);

    expect(direct.id).toBe("montage_generate");
    expect(namespaced.id).toBe("montage_generate");
    expect(direct.inputSchema).toEqual(namespaced.inputSchema);

    await direct.execute({
      context: { prompt: "pipeline", dataInfo: "{}" },
    });

    expect(toolkit.execute).toHaveBeenCalledWith({
      prompt: "pipeline",
      dataInfo: "{}",
    });
  });

  it("exposes AI SDK tooling with both v5 inputSchema and legacy parameters", async () => {
    const toolkit = createToolkit();
    const tool = createMontageAiSdkTool(toolkit, z);
    const alias = createMontageVercelAiTool(toolkit, z);

    expect(tool.description).toContain("Generate");
    expect(tool.inputSchema).toBe(tool.parameters);
    expect(alias.inputSchema).toEqual(tool.inputSchema);

    await tool.execute({ prompt: "dashboard", dataInfo: "{}" });

    expect(toolkit.execute).toHaveBeenCalledWith({
      prompt: "dashboard",
      dataInfo: "{}",
    });
  });
});

