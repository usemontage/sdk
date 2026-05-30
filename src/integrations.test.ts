import { describe, expect, it, vi } from "vitest";
import {
  langchainAgentAction,
  mastraAgentAction,
  copilotKitAgentAction,
  openaiResponsesAgentAction,
  rawAgentAction,
  vercelAiAgentAction,
} from "./integrations";

function createZodStub() {
  const schema = {
    optional: () => schema,
    describe: () => schema,
  };
  const z = {
    object: vi.fn(() => schema),
    string: vi.fn(() => schema),
    enum: vi.fn(() => schema),
    record: vi.fn(() => schema),
    unknown: vi.fn(() => schema),
  };
  return { z, schema };
}

describe("agent action integration adapters", () => {
  it("creates a Mastra-compatible agent-action tool", async () => {
    const { z, schema } = createZodStub();
    const handler = vi.fn(async (request) => ({
      type: "text" as const,
      content: `handled ${request.action}`,
    }));
    const tool = mastraAgentAction(handler, z);

    expect(tool.id).toBe("montage_agent_action");
    expect(tool.inputSchema).toBe(schema);
    await expect(
      tool.execute({
        action: "answer",
        instruction: "Explain this anomaly.",
      }),
    ).resolves.toEqual({
      type: "text",
      content: "handled answer",
    });
    expect(handler).toHaveBeenCalledWith({
      action: "answer",
      instruction: "Explain this anomaly.",
    });
  });

  it("serializes LangChain agent-action results as JSON strings", async () => {
    const { z } = createZodStub();
    const tool = langchainAgentAction(async () => ({
      type: "artifact",
      artifactId: "art_1",
      revisionId: "rev_2",
    }), z);

    await expect(
      tool.func({
        action: "render_ui",
        instruction: "Render a follow-up chart.",
      }),
    ).resolves.toBe(JSON.stringify({
      type: "artifact",
      artifactId: "art_1",
      revisionId: "rev_2",
    }));
  });

  it("returns structured errors for invalid raw agent-action input", async () => {
    const handler = vi.fn();
    const tool = rawAgentAction(handler);

    await expect(tool.execute({ action: "answer" })).resolves.toEqual({
      type: "error",
      code: "INVALID_AGENT_ACTION",
      message: "Montage agent action request is invalid.",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("wraps handler exceptions as agent-action error results", async () => {
    const { z } = createZodStub();
    const tool = vercelAiAgentAction(async () => {
      throw new Error("agent backend unavailable");
    }, z);

    await expect(
      tool.execute({
        action: "run_workflow",
        instruction: "Refresh this artifact from source data.",
      }),
    ).resolves.toEqual({
      type: "error",
      message: "agent backend unavailable",
    });
  });

  it("creates an OpenAI Responses-compatible agent-action adapter", async () => {
    const handler = vi.fn(async (request) => ({
      type: "html" as const,
      html: `<main>${request.instruction}</main>`,
    }));
    const adapter = openaiResponsesAgentAction(handler);

    expect(adapter.tool).toMatchObject({
      type: "function",
      name: "montage_agent_action",
      parameters: {
        required: ["action", "instruction"],
      },
    });

    const result = await adapter.execute({
      type: "function_call",
      call_id: "call_123",
      name: "montage_agent_action",
      arguments: JSON.stringify({
        action: "render_ui",
        instruction: "Render renewal-risk UI.",
      }),
    });

    expect(result).toEqual({
      type: "html",
      html: "<main>Render renewal-risk UI.</main>",
    });
    expect(handler).toHaveBeenCalledWith({
      action: "render_ui",
      instruction: "Render renewal-risk UI.",
    });
    expect(adapter.toOutputItem("call_123", result)).toEqual({
      type: "function_call_output",
      call_id: "call_123",
      output: JSON.stringify(result),
    });
  });

  it("creates a CopilotKit useFrontendTool-compatible agent-action config", async () => {
    const { z, schema } = createZodStub();
    const handler = vi.fn(async () => ({
      type: "patch" as const,
      artifactId: "art_1",
      revisionId: "rev_2",
      summary: "Patched by CopilotKit host",
    }));
    const tool = copilotKitAgentAction(handler, z);

    expect(tool.name).toBe("montage_agent_action");
    expect(tool.parameters).toBe(schema);
    await expect(
      tool.handler({
        artifactId: "art_1",
        action: "patch_artifact",
        instruction: "Patch this artifact.",
      }),
    ).resolves.toEqual({
      type: "patch",
      artifactId: "art_1",
      revisionId: "rev_2",
      summary: "Patched by CopilotKit host",
    });
    expect(handler).toHaveBeenCalledWith({
      artifactId: "art_1",
      action: "patch_artifact",
      instruction: "Patch this artifact.",
    });
  });
});
