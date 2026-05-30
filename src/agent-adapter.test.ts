import { describe, expect, it } from "vitest";
import { MontageError } from "./errors";
import { createMontageAdapter } from "./agent-adapter";

const companyAgent = {
  id: "agent-x",
  name: "Agent X",
  capabilities: ["query crm", "agent tools"],
};

describe("createMontageAdapter runtime contract", () => {
  it("lists tools and invokes them as Montage generate requests", async () => {
    const adapter = createMontageAdapter({
      agent: companyAgent,
      tools: [
        {
          name: "fundraising.show-pipeline",
          description: "Show the current fundraising pipeline.",
        },
      ],
      async invoke(request) {
        expect(request).toEqual({
          tool: "fundraising.show-pipeline",
          input: undefined,
        });
        return {
          prompt: "Generate the fundraising pipeline artifact.",
          dataInfo: "Sequoia Capital | stage=prospecting",
        };
      },
    });

    expect(adapter.tools).toEqual([
      {
        name: "fundraising.show-pipeline",
        description: "Show the current fundraising pipeline.",
      },
    ]);
    expect(adapter.listTools()).toEqual(adapter.tools);

    await expect(
      adapter.invoke({ tool: "fundraising.show-pipeline" }),
    ).resolves.toEqual({
      prompt: "Generate the fundraising pipeline artifact.",
      dataInfo: "Sequoia Capital | stage=prospecting",
    });
  });

  it("allows adapter tools to carry a normalized design system for generation", async () => {
    const adapter = createMontageAdapter({
      agent: companyAgent,
      tools: [
        {
          name: "crm.show-workspace",
          description: "Show the CRM workspace.",
        },
      ],
      invoke() {
        return {
          prompt: "Generate the CRM workspace.",
          dataInfo: "Accounts and opportunities",
          designSystem: {
            label: "Acme Revenue OS",
            theme: "dark",
            colors: {
              primary: "#ff6a00",
            },
          },
        };
      },
    });

    await expect(
      adapter.invoke({ tool: "crm.show-workspace" }),
    ).resolves.toMatchObject({
      prompt: "Generate the CRM workspace.",
      designSystem: {
        id: "custom:acme-revenue-os",
        label: "Acme Revenue OS",
        colors: {
          primary: "#ff6a00",
        },
      },
    });
  });

  it("allows adapter tools to request a render surface", async () => {
    const adapter = createMontageAdapter({
      agent: companyAgent,
      tools: [
        {
          name: "project.render-command-center",
          description: "Render a project command center artifact.",
        },
      ],
      invoke() {
        return {
          prompt: "Build a project command center.",
          dataInfo: "Projects, risks, milestones, and capacity.",
          renderSurface: {
            width: 760,
            height: 720,
            viewportWidth: 1440,
            viewportHeight: 900,
          },
        };
      },
    });

    await expect(
      adapter.invoke({ tool: "project.render-command-center" }),
    ).resolves.toEqual({
      prompt: "Build a project command center.",
      dataInfo: "Projects, risks, milestones, and capacity.",
      renderSurface: {
        width: 760,
        height: 720,
        viewportWidth: 1440,
        viewportHeight: 900,
      },
    });
  });

  it("rejects unknown adapter tools before invoking customer code", async () => {
    const adapter = createMontageAdapter({
      agent: companyAgent,
      tools: [
        {
          name: "fundraising.show-pipeline",
          description: "Show the current fundraising pipeline.",
        },
      ],
      invoke() {
        throw new Error("should not be reached");
      },
    });

    await expect(
      adapter.invoke({ tool: "fundraising.unknown-tool" }),
    ).rejects.toMatchObject({
      code: "adapter.unknown-tool",
    } satisfies Partial<MontageError>);
  });

  it("rejects customer adapter responses that include unsupported keys", async () => {
    const adapter = createMontageAdapter({
      agent: companyAgent,
      tools: [
        {
          name: "fundraising.show-pipeline",
          description: "Show the current fundraising pipeline.",
        },
      ],
      invoke() {
        return {
          prompt: "Generate the fundraising pipeline artifact.",
          dataInfo: "Sequoia Capital | stage=prospecting",
          intent: {
            component: "html",
          },
        } as unknown as {
          prompt: string;
          dataInfo: string;
        };
      },
    });

    await expect(
      adapter.invoke({ tool: "fundraising.show-pipeline" }),
    ).rejects.toMatchObject({
      code: "adapter.invalid-generate-request",
    } satisfies Partial<MontageError>);
  });

  it("rejects invalid adapter render-surface fields", async () => {
    const adapter = createMontageAdapter({
      agent: companyAgent,
      tools: [
        {
          name: "project.render-command-center",
          description: "Render a project command center artifact.",
        },
      ],
      invoke() {
        return {
          prompt: "Build a project command center.",
          dataInfo: "Projects, risks, milestones, and capacity.",
          renderSurface: { width: -1 },
        } as never;
      },
    });

    await expect(
      adapter.invoke({ tool: "project.render-command-center" }),
    ).rejects.toMatchObject({
      code: "adapter.invalid-generate-request",
    } satisfies Partial<MontageError>);
  });

  it("lists capability manifests and invokes adapter capabilities by name", async () => {
    const adapter = createMontageAdapter({
      agent: companyAgent,
      capabilities: [
        {
          name: "artifact.pdf.render",
          effect: "effect",
          description: "Render a PDF artifact through the host.",
          availability: "adapter",
        },
      ],
      async invokeCapability(request) {
        expect(request).toMatchObject({
          name: "artifact.pdf.render",
          source: "artifact.pdf.render",
          effect: "effect",
          args: [{ title: "Lead brief" }],
        });
        return {
          id: "artifact_pdf_1",
          kind: "pdf",
          name: "Lead brief.pdf",
          mimeType: "application/pdf",
        };
      },
    });

    expect(adapter.listCapabilities()).toEqual([
      expect.objectContaining({
        name: "artifact.pdf.render",
        source: "artifact.pdf.render",
        effect: "effect",
      }),
    ]);
    expect(adapter.getCapabilityManifest().capabilities).toEqual(adapter.listCapabilities());

    await expect(
      adapter.invokeCapability({
        name: "artifact.pdf.render",
        source: "artifact.pdf.render",
        effect: "effect",
        args: [{ title: "Lead brief" }],
      }),
    ).resolves.toMatchObject({
      id: "artifact_pdf_1",
      kind: "pdf",
    });
  });

  it("validates capability input and output schemas when provided", async () => {
    const adapter = createMontageAdapter({
      agent: companyAgent,
      capabilities: [
        {
          name: "artifact.pdf.render",
          effect: "effect",
          description: "Render a PDF artifact through the host.",
          availability: "adapter",
          inputSchema: {
            type: "object",
            required: ["title"],
            properties: {
              title: { type: "string" },
            },
          },
          outputSchema: {
            type: "object",
            required: ["kind", "name"],
            properties: {
              kind: { const: "pdf" },
              name: { type: "string" },
            },
          },
        },
      ],
      invokeCapability() {
        return {
          kind: "pdf",
          name: "Lead brief.pdf",
        };
      },
    });

    await expect(
      Promise.resolve().then(() => adapter.invokeCapability({
        name: "artifact.pdf.render",
        source: "artifact.pdf.render",
        effect: "effect",
        args: [{ title: "Lead brief" }],
      })),
    ).resolves.toMatchObject({ kind: "pdf", name: "Lead brief.pdf" });

    await expect(
      Promise.resolve().then(() => adapter.invokeCapability({
        name: "artifact.pdf.render",
        source: "artifact.pdf.render",
        effect: "effect",
        args: [{ title: 42 }],
      })),
    ).rejects.toMatchObject({
      code: "capability.invalid-request",
    } satisfies Partial<MontageError>);
  });

  it("strips undeclared object args before invoking customer capability code", async () => {
    const received: unknown[] = [];
    const adapter = createMontageAdapter({
      agent: companyAgent,
      capabilities: [
        {
          name: "deal_stage_change",
          effect: "effect",
          description: "Move a deal through the pipeline.",
          inputSchema: {
            type: "object",
            required: ["dealId", "stage"],
            properties: {
              dealId: { type: "string" },
              stage: { type: "string" },
              note: { type: "string" },
            },
          },
        },
      ],
      invokeCapability(request) {
        received.push(request.args);
        return { ok: true };
      },
    });

    await expect(
      Promise.resolve().then(() => adapter.invokeCapability({
        name: "deal_stage_change",
        source: "deal_stage_change",
        effect: "effect",
        args: {
          dealId: "deal-001",
          stage: "Negotiation",
          note: "Customer asked for review.",
          alertThreshold: 250000,
          secret: "do-not-forward",
        } as never,
      })),
    ).resolves.toEqual({ ok: true });

    expect(received).toEqual([
      {
        dealId: "deal-001",
        stage: "Negotiation",
        note: "Customer asked for review.",
      },
    ]);
  });

  it("rejects capability output that fails its schema", async () => {
    const adapter = createMontageAdapter({
      agent: companyAgent,
      capabilities: [
        {
          name: "artifact.pdf.render",
          effect: "effect",
          description: "Render a PDF artifact through the host.",
          availability: "adapter",
          outputSchema: {
            type: "object",
            required: ["kind"],
            properties: {
              kind: { const: "pdf" },
            },
          },
        },
      ],
      invokeCapability() {
        return { kind: "html" };
      },
    });

    await expect(
      Promise.resolve().then(() => adapter.invokeCapability({
        name: "artifact.pdf.render",
        source: "artifact.pdf.render",
        effect: "effect",
        args: [{ title: "Lead brief" }],
      })),
    ).rejects.toMatchObject({
      code: "capability.invalid-request",
    } satisfies Partial<MontageError>);
  });

  it("rejects unknown or effect-mismatched capabilities before invoking customer code", async () => {
    const adapter = createMontageAdapter({
      agent: companyAgent,
      capabilities: [
        {
          name: "collection.query",
          effect: "query",
          description: "Query a local collection.",
        },
      ],
      invokeCapability() {
        throw new Error("should not be reached");
      },
    });

    await expect(
      Promise.resolve().then(() => adapter.invokeCapability({
        name: "collection.query",
        source: "collection.query",
        effect: "effect",
        args: [],
      })),
    ).rejects.toMatchObject({
      code: "capability.effect-mismatch",
    } satisfies Partial<MontageError>);

    await expect(
      Promise.resolve().then(() => adapter.invokeCapability({
        name: "collection.missing",
        source: "collection.missing",
        effect: "query",
        args: [],
      })),
    ).rejects.toMatchObject({
      code: "capability.unknown",
    } satisfies Partial<MontageError>);
  });
});
