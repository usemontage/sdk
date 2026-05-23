import { describe, expect, it, vi } from "vitest";
import type { MontageToolkit } from "./tools";
import { agno, cloudflareAgent, strands } from "./integrations";

function createToolkit(): MontageToolkit {
  return {
    adapters: {
      configure: vi.fn(),
      list: vi.fn(),
      remove: vi.fn(),
    },
    execute: vi.fn(async (input) => ({
      id: "gen_1",
      html: "<html></html>",
      creditsUsed: 1,
      artifactId: input.artifactId,
    })),
    stream: vi.fn(),
    executeStreaming: vi.fn(),
    executeFragment: vi.fn(),
    anthropic: vi.fn(),
    openai: vi.fn(),
  } as unknown as MontageToolkit;
}

describe("framework integrations", () => {
  it("creates an Agno-compatible JSON schema tool", async () => {
    const toolkit = createToolkit();
    const tool = agno(toolkit);

    expect(tool.name).toBe("montage_generate");
    expect(tool.parameters.required).toContain("prompt");
    await expect(tool.execute({ prompt: "Build a dashboard" })).resolves.toMatchObject({
      id: "gen_1",
      html: "<html></html>",
    });
    expect(toolkit.execute).toHaveBeenCalledWith({
      prompt: "Build a dashboard",
      dataInfo: "",
    });
  });

  it("creates a Cloudflare Agents tool", async () => {
    const toolkit = createToolkit();
    const tool = cloudflareAgent(toolkit);

    expect(tool.name).toBe("montage_generate");
    expect(tool.parameters.properties.dataInfo.type).toBe("string");
    await tool.execute({
      prompt: "Build a support queue",
      dataInfo: "{\"tickets\":[]}",
    });
    expect(toolkit.execute).toHaveBeenCalledWith({
      prompt: "Build a support queue",
      dataInfo: "{\"tickets\":[]}",
    });
  });

  it("creates a Strands-compatible JSON schema tool", async () => {
    const toolkit = createToolkit();
    const tool = strands(toolkit);

    expect(tool.name).toBe("montage_generate");
    expect(tool.description).toContain("production UI artifact");
    await tool.execute({ prompt: "Build a field ops app", interactive: true });
    expect(toolkit.execute).toHaveBeenCalledWith({
      prompt: "Build a field ops app",
      dataInfo: "",
      interactive: true,
    });
  });
});

