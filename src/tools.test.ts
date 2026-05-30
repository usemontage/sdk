import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JSDOM } from "jsdom";
import {
  createMontageStreamSurface,
  createMontageTools,
  MontageApiError,
  normalizeMontageStreamEvent,
} from "./tools";
import type { MontageStreamOptions } from "./tools";
import { createMontageAdapter } from "./agent-adapter";

const originalFetch = globalThis.fetch;

function createSseResponse(events: unknown[]): Response {
  const encoder = new TextEncoder();
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    body: new ReadableStream({
      start(controller) {
        for (const event of events) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        }
        controller.close();
      },
    }),
  } as Response;
}

describe("createMontageTools", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns an object with execute, anthropic, and openai methods", () => {
    const tools = createMontageTools({ apiKey: "sk_test" });
    expect(typeof tools.adapters.configure).toBe("function");
    expect(typeof tools.adapters.list).toBe("function");
    expect(typeof tools.adapters.remove).toBe("function");
    expect(typeof tools.orgs.create).toBe("function");
    expect(typeof tools.orgs.list).toBe("function");
    expect(typeof tools.orgs.get).toBe("function");
    expect(typeof tools.orgs.listMembers).toBe("function");
    expect(typeof tools.orgs.upsertMember).toBe("function");
    expect(typeof tools.artifacts.create).toBe("function");
    expect(typeof tools.artifacts.streamCreate).toBe("function");
    expect(typeof tools.artifacts.update).toBe("function");
    expect(typeof tools.artifacts.patch).toBe("function");
    expect(typeof tools.artifacts.restyle).toBe("function");
    expect(typeof tools.artifacts.list).toBe("function");
    expect(typeof tools.artifacts.get).toBe("function");
    expect(typeof tools.artifacts.export).toBe("function");
    expect(typeof tools.artifacts.exportHtml).toBe("function");
    expect(typeof tools.artifacts.exportArchive).toBe("function");
    expect(typeof tools.artifacts.createProof).toBe("function");
    expect(typeof tools.artifacts.runProof).toBe("function");
    expect(typeof tools.artifacts.listProofs).toBe("function");
    expect(typeof tools.artifacts.getProof).toBe("function");
    expect(typeof tools.artifacts.listProofAssets).toBe("function");
    expect(typeof tools.designSystems.create).toBe("function");
    expect(typeof tools.designSystems.list).toBe("function");
    expect(typeof tools.designSystems.get).toBe("function");
    expect(typeof tools.designSystems.update).toBe("function");
    expect(typeof tools.designSystems.fork).toBe("function");
    expect(typeof tools.designSystems.import).toBe("function");
    expect(typeof tools.templates.create).toBe("function");
    expect(typeof tools.templates.list).toBe("function");
    expect(typeof tools.templates.get).toBe("function");
    expect(typeof tools.templates.fork).toBe("function");
    expect(typeof tools.deployments.create).toBe("function");
    expect(typeof tools.deployments.list).toBe("function");
    expect(typeof tools.deployments.get).toBe("function");
    expect(typeof tools.deployments.promote).toBe("function");
    expect(typeof tools.deployments.revoke).toBe("function");
    expect(typeof tools.deployments.getCache).toBe("function");
    expect(typeof tools.deployments.invalidateCache).toBe("function");
    expect(typeof tools.deployments.prewarmCache).toBe("function");
    expect(typeof tools.deployments.getCapabilityUsage).toBe("function");
    expect(typeof tools.deployments.getAgentActionUsage).toBe("function");
    expect(typeof tools.execute).toBe("function");
    expect(typeof tools.anthropic).toBe("function");
    expect(typeof tools.openai).toBe("function");
  });

  it("works with minimal config", () => {
    const tools = createMontageTools({ apiKey: "sk_minimal" });
    expect(tools).toBeDefined();
    expect(tools.anthropic()).toHaveLength(1);
  });

  it("works with full config", () => {
    const tools = createMontageTools({
      apiKey: "sk_full",
      apiUrl: "https://custom.api.dev",
      headers: { "x-montage-request-source": "test-suite" },
      defaults: {
        designSystem: { theme: "dark", colors: { primary: "#ff0000" } },
        renderSurface: { width: 1920, height: 1080 },
      },
    });
    expect(tools).toBeDefined();
    expect(tools.openai()).toHaveLength(1);
  });

  it("passes additional request headers to artifact SDK requests without overriding Authorization", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ artifacts: [] }),
    });

    const tools = createMontageTools({
      apiKey: "sk_header_test",
      headers: {
        Authorization: "Bearer attacker",
        "x-montage-dashboard-internal-secret": "bridge_secret",
        "x-montage-dashboard-user-id": "user_1",
        "x-montage-dashboard-org-id": "org_1",
        "x-montage-dashboard-org-role": "owner",
      },
    });

    await tools.artifacts.list();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.usemontage.ai/v1/artifacts",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer sk_header_test",
          "x-montage-dashboard-internal-secret": "bridge_secret",
          "x-montage-dashboard-user-id": "user_1",
          "x-montage-dashboard-org-id": "org_1",
          "x-montage-dashboard-org-role": "owner",
        }),
      }),
    );
  });

  it("passes additional request headers to artifact streaming requests", async () => {
    mockFetch.mockResolvedValueOnce(
      createSseResponse([{ type: "status", text: "ok" }]),
    );

    const tools = createMontageTools({
      apiKey: "sk_stream_header_test",
      headers: {
        "x-montage-dashboard-internal-secret": "bridge_secret",
        "x-montage-dashboard-user-id": "user_1",
        "x-montage-dashboard-org-id": "org_1",
        "x-montage-dashboard-org-role": "editor",
      },
    });

    await tools.artifacts.streamCreate(
      { request: "Build a CRM", hosted: true },
      () => undefined,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.usemontage.ai/v1/artifacts",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer sk_stream_header_test",
          "Content-Type": "application/json",
          "x-montage-dashboard-internal-secret": "bridge_secret",
          "x-montage-dashboard-user-id": "user_1",
          "x-montage-dashboard-org-id": "org_1",
          "x-montage-dashboard-org-role": "editor",
        }),
      }),
    );
  });

  it("passes additional request headers to resource and generate helpers", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            deployment: {
              deploymentId: "dep_1",
              artifactId: "art_1",
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: {
            proof: {
              proofId: "proof_1",
              artifactId: "art_1",
              revisionId: "rev_1",
              status: "passed",
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: "gen_1",
          html: "<div>Generated</div>",
          creditsUsed: 1,
        }),
      });

    const tools = createMontageTools({
      apiKey: "sk_bridge_header_test",
      headers: {
        Authorization: "Bearer attacker",
        "x-montage-dashboard-internal-secret": "bridge_secret",
        "x-montage-dashboard-user-id": "user_1",
        "x-montage-dashboard-org-id": "org_1",
        "x-montage-dashboard-org-role": "editor",
      },
    });

    await tools.deployments.get("dep_1");
    await tools.artifacts.createProof("art_1", "rev_1", {
      status: "passed",
    });
    await tools.execute({ prompt: "Build a CRM", dataInfo: "{}" });

    for (const [, init] of mockFetch.mock.calls) {
      expect(init?.headers).toEqual(
        expect.objectContaining({
          Authorization: "Bearer sk_bridge_header_test",
          "x-montage-dashboard-internal-secret": "bridge_secret",
          "x-montage-dashboard-user-id": "user_1",
          "x-montage-dashboard-org-id": "org_1",
          "x-montage-dashboard-org-role": "editor",
        }),
      );
    }
  });

  describe("orgs", () => {
    it("creates, lists, reads, lists members, and upserts org members", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: {
              org: {
                orgId: "org_1",
                name: "Acme",
                slug: "acme",
                kind: "team",
                role: "owner",
              },
              member: {
                orgId: "org_1",
                userId: "u1",
                role: "owner",
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            orgs: [
              {
                orgId: "org_1",
                name: "Acme",
                slug: "acme",
                kind: "team",
                role: "owner",
              },
            ],
            limit: 10,
            offset: 5,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            org: {
              orgId: "org_1",
              name: "Acme",
              slug: "acme",
              kind: "team",
              role: "admin",
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            orgId: "org_1",
            members: [
              { orgId: "org_1", userId: "u1", role: "owner" },
              { orgId: "org_1", userId: "u2", role: "editor" },
            ],
            limit: 20,
            offset: 0,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: {
              member: {
                orgId: "org_1",
                userId: "u3",
                role: "viewer",
              },
            },
          }),
        });

      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
      });

      const created = await tools.orgs.create({
        name: "Acme",
        slug: "acme",
        kind: "team",
      });
      const list = await tools.orgs.list({ limit: 10, offset: 5 });
      const detail = await tools.orgs.get("org_1");
      const members = await tools.orgs.listMembers("org_1", { limit: 20 });
      const member = await tools.orgs.upsertMember("org_1", {
        userId: "u3",
        role: "viewer",
      });

      expect(created.org.orgId).toBe("org_1");
      expect(created.member.role).toBe("owner");
      expect(list.orgs).toEqual([
        {
          orgId: "org_1",
          name: "Acme",
          slug: "acme",
          kind: "team",
          role: "owner",
        },
      ]);
      expect(detail.org.role).toBe("admin");
      expect(members.members).toEqual([
        { orgId: "org_1", userId: "u1", role: "owner" },
        { orgId: "org_1", userId: "u2", role: "editor" },
      ]);
      expect(member.member.userId).toBe("u3");
      expect(
        mockFetch.mock.calls.map(([url, init]) => [url, init?.method ?? "GET"]),
      ).toEqual([
        ["https://api.example.test/v1/orgs", "POST"],
        ["https://api.example.test/v1/orgs?limit=10&offset=5", "GET"],
        ["https://api.example.test/v1/orgs/org_1", "GET"],
        ["https://api.example.test/v1/orgs/org_1/members?limit=20", "GET"],
        ["https://api.example.test/v1/orgs/org_1/members", "POST"],
      ]);
      expect(JSON.parse(String(mockFetch.mock.calls[0][1]?.body))).toEqual({
        name: "Acme",
        slug: "acme",
        kind: "team",
      });
      expect(JSON.parse(String(mockFetch.mock.calls[4][1]?.body))).toEqual({
        userId: "u3",
        role: "viewer",
      });
    });
  });

  describe("anthropic", () => {
    it("returns an array with one tool definition", () => {
      const tools = createMontageTools({ apiKey: "sk_test" });
      const defs = tools.anthropic();
      expect(defs).toHaveLength(1);
    });

    it("has the correct tool name", () => {
      const tools = createMontageTools({ apiKey: "sk_test" });
      const [def] = tools.anthropic();
      expect(def.name).toBe("montage_generate");
    });

    it("has name, description, and input_schema fields", () => {
      const tools = createMontageTools({ apiKey: "sk_test" });
      const [def] = tools.anthropic();
      expect(def).toHaveProperty("name");
      expect(def).toHaveProperty("description");
      expect(def).toHaveProperty("input_schema");
    });

    it("input_schema has type object and accepts prompt or input with dataInfo", () => {
      const tools = createMontageTools({ apiKey: "sk_test" });
      const [def] = tools.anthropic();
      expect(def.input_schema.type).toBe("object");
      expect(def.input_schema.required).toEqual(["dataInfo"]);
      expect(def.input_schema.anyOf).toEqual([
        { required: ["prompt"] },
        { required: ["input"] },
      ]);
    });

    it("input_schema.properties has input, prompt, dataInfo, and designSystem", () => {
      const tools = createMontageTools({ apiKey: "sk_test" });
      const [def] = tools.anthropic();
      const props = def.input_schema.properties as Record<string, unknown>;
      expect(props).toHaveProperty("input");
      expect(props).toHaveProperty("prompt");
      expect(props).toHaveProperty("dataInfo");
      expect(props).toHaveProperty("designSystem");
    });

    it("exposes agent contract controls in the tool schema", () => {
      const tools = createMontageTools({ apiKey: "sk_test" });
      const [def] = tools.anthropic();
      const props = def.input_schema.properties as Record<string, unknown>;

      expect(props).toEqual(
        expect.objectContaining({
          hosted: expect.objectContaining({ type: "boolean" }),
          strictData: expect.objectContaining({ type: "boolean" }),
          requiredFields: expect.objectContaining({ type: "array" }),
          requiredCapabilities: expect.objectContaining({ type: "array" }),
          data: expect.objectContaining({ description: expect.any(String) }),
        }),
      );
    });

    it("description mentions visual and markdown", () => {
      const tools = createMontageTools({ apiKey: "sk_test" });
      const [def] = tools.anthropic();
      expect(def.description.toLowerCase()).toContain("visual");
      expect(def.description.toLowerCase()).toContain("markdown");
    });
  });

  describe("adapters", () => {
    it("configures, lists, and removes adapter credentials", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: [
              {
                provider: "supabase",
                configuredAt: "2026-05-20T00:00:00Z",
                keys: ["SUPABASE_URL"],
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
          json: async () => ({}),
        });

      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
      });

      await tools.adapters.configure("supabase", {
        SUPABASE_URL: "https://acme.supabase.co",
        SUPABASE_ANON_KEY: "anon",
      });
      const adapters = await tools.adapters.list();
      await tools.adapters.remove("supabase");

      expect(adapters).toEqual([
        {
          provider: "supabase",
          configuredAt: "2026-05-20T00:00:00Z",
          keys: ["SUPABASE_URL"],
        },
      ]);
      expect(mockFetch.mock.calls[0][0]).toBe(
        "https://api.example.test/v1/adapters/supabase",
      );
      expect(mockFetch.mock.calls[0][1].method).toBe("PUT");
      expect(mockFetch.mock.calls[1][0]).toBe(
        "https://api.example.test/v1/adapters",
      );
      expect(mockFetch.mock.calls[2][1].method).toBe("DELETE");
    });
  });

  describe("artifacts", () => {
    it("creates saved artifacts through the M2 artifact resource endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: {
            artifact: {
              artifactId: "art_1",
              userId: "user_1",
              currentRevisionId: "rev_1",
              currentVersion: "rev_1",
              createdAt: "2026-05-24T00:00:00Z",
              updatedAt: "2026-05-24T00:00:00Z",
            },
            revision: {
              revisionId: "rev_1",
              version: "hash_1",
            },
            generation: {
              id: "gen_1",
              creditsUsed: 20,
            },
            html: "<main>CRM</main>",
            hostedUrl: "https://api.example.test/a/art_1",
            proof: {
              proofId: "proof_auto_1",
              artifactId: "art_1",
              revisionId: "rev_1",
              status: "passed",
              summary: "Automated render proof passed.",
            },
          },
        }),
      });

      const adapter = createMontageAdapter({
        agent: { id: "sales-agent", name: "Sales Agent" },
        capabilities: [
          {
            name: "saveAccount",
            effect: "effect",
            description: "Save an account.",
          },
        ],
        invokeCapability: async () => ({ ok: true }),
      });
      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
        defaults: {
          designSystem: { theme: "light", label: "Acme" },
        },
      });

      const result = await tools.artifacts.create({
        request: "Build a CRM import workspace",
        designSystemVersionId: "dsv_1",
        context: {
          data: { accounts: [] },
          deployment: { mode: "preview" },
        },
        constraints: {
          hosted: true,
          interactive: true,
          requiredFields: ["accounts.email"],
        },
        adapter,
      });

      expect(result.artifact.artifactId).toBe("art_1");
      expect(result.revision?.revisionId).toBe("rev_1");
      expect(result.html).toBe("<main>CRM</main>");
      expect(result.hostedUrl).toBe("https://api.example.test/a/art_1");
      expect(result.proof?.status).toBe("passed");
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.example.test/v1/artifacts");
      expect(opts.method).toBe("POST");
      expect(opts.headers["Authorization"]).toBe("Bearer sk_test");
      const body = JSON.parse(opts.body);
      expect(body).toEqual(
        expect.objectContaining({
          request: "Build a CRM import workspace",
          designSystemVersionId: "dsv_1",
          context: expect.objectContaining({
            data: { accounts: [] },
            deployment: { mode: "preview" },
            designSystem: { theme: "light", label: "Acme" },
          }),
          constraints: {
            hosted: true,
            interactive: true,
            requiredFields: ["accounts.email"],
          },
          adapterManifest: {
            capabilities: [
              expect.objectContaining({
                name: "saveAccount",
                effect: "effect",
                availability: "adapter",
              }),
            ],
          },
        }),
      );
      expect(typeof body.requestId).toBe("string");
      expect(body.requestId.startsWith("mtg_")).toBe(true);
    });

    it("creates saved artifacts with OpenAI-style input", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: {
            artifact: { artifactId: "art_1" },
            generation: { id: "gen_1", creditsUsed: 20 },
            html: "<main>CRM</main>",
          },
        }),
      });
      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
      });

      await tools.artifacts.create({
        input: "Build a CRM import workspace",
      });

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body).not.toHaveProperty("request");
      expect(body.input).toBe("Build a CRM import workspace");
    });

    it("streams saved artifact creation through the M2 artifact resource endpoint", async () => {
      mockFetch.mockResolvedValueOnce(
        createSseResponse([
          { type: "status", text: "Creating artifact..." },
          {
            type: "done",
            artifactId: "art_stream",
            version: "rev_stream",
            html: "<main>Streamed artifact</main>",
          },
        ]),
      );
      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
        defaults: {
          designSystem: { theme: "light", label: "Acme" },
        },
      });
      const events: unknown[] = [];

      await tools.artifacts.streamCreate(
        {
          request: "Build a streamed workspace",
          context: {
            dataInfo: "Accounts and tasks",
          },
          constraints: {
            hosted: true,
            interactive: true,
          },
        },
        (event) => {
          events.push(event);
        },
      );

      expect(events).toEqual([
        { type: "status", text: "Creating artifact..." },
        {
          type: "done",
          artifactId: "art_stream",
          version: "rev_stream",
          html: "<main>Streamed artifact</main>",
        },
      ]);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.example.test/v1/artifacts");
      expect(opts.method).toBe("POST");
      expect(opts.headers["Authorization"]).toBe("Bearer sk_test");
      const body = JSON.parse(opts.body);
      expect(body).toEqual(
        expect.objectContaining({
          request: "Build a streamed workspace",
          streaming: true,
          context: expect.objectContaining({
            dataInfo: "Accounts and tasks",
            designSystem: { theme: "light", label: "Acme" },
          }),
          constraints: {
            hosted: true,
            interactive: true,
          },
        }),
      );
    });

    it("lists, reads, and reads revisions for saved artifacts", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            artifacts: [{ artifactId: "art_1", currentVersion: "rev_1" }],
            limit: 10,
            offset: 5,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            artifactId: "art_1",
            currentVersion: "rev_1",
            ir: { kind: "shell" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            artifactId: "art_1",
            revisions: [
              {
                revisionId: "rev_1",
                contentHash: "hash_1",
                parentRevisionId: null,
                instruction: "Add renewal risks.",
                changeSummary: "Patch: Add renewal risks.",
                signature: { renderGrammar: "fluxui" },
                source: "m2.artifacts.patch",
                htmlBundleRef: "hosted-html:v1:art_1:rev_1:hash_1",
                qaStatus: "passed",
                designSystemVersionId: null,
                operation: "patch",
                hasGraphArtifacts: true,
                quality: {
                  diagnosticCount: 0,
                  repairIterations: 1,
                  validatorPassedFirstTry: true,
                  componentCount: 4,
                  chartCount: 1,
                  interactiveElementCount: 2,
                  shellType: "application",
                },
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            artifactId: "art_1",
            revisionId: "rev_1",
            contentHash: "hash_1",
            instruction: "Add renewal risks.",
            changeSummary: "Patch: Add renewal risks.",
            signature: { renderGrammar: "fluxui" },
            source: "m2.artifacts.patch",
            htmlBundleRef: "hosted-html:v1:art_1:rev_1:hash_1",
            qaStatus: "passed",
            designSystemVersionId: null,
            operation: "patch",
            hasGraphArtifacts: true,
            graphArtifacts: { setupSql: "-- setup" },
            quality: {
              diagnosticCount: 0,
              repairIterations: 1,
              validatorPassedFirstTry: true,
              componentCount: 4,
              chartCount: 1,
              interactiveElementCount: 2,
              shellType: "application",
            },
            ir: { kind: "shell" },
          }),
        });

      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
      });

      const list = await tools.artifacts.list({ limit: 10, offset: 5 });
      const artifact = await tools.artifacts.get("art_1");
      const revisions = await tools.artifacts.listRevisions("art_1", {
        limit: 3,
      });
      const revision = await tools.artifacts.getRevision("art_1", "rev_1");

      expect(list.artifacts).toEqual([
        { artifactId: "art_1", currentVersion: "rev_1" },
      ]);
      expect(artifact.ir).toEqual({ kind: "shell" });
      expect(revisions.revisions).toEqual([
        {
          revisionId: "rev_1",
          contentHash: "hash_1",
          parentRevisionId: null,
          instruction: "Add renewal risks.",
          changeSummary: "Patch: Add renewal risks.",
          signature: { renderGrammar: "fluxui" },
          source: "m2.artifacts.patch",
          htmlBundleRef: "hosted-html:v1:art_1:rev_1:hash_1",
          qaStatus: "passed",
          designSystemVersionId: null,
          operation: "patch",
          hasGraphArtifacts: true,
          quality: {
            diagnosticCount: 0,
            repairIterations: 1,
            validatorPassedFirstTry: true,
            componentCount: 4,
            chartCount: 1,
            interactiveElementCount: 2,
            shellType: "application",
          },
        },
      ]);
      expect(revision.ir).toEqual({ kind: "shell" });
      expect(revision.htmlBundleRef).toBe("hosted-html:v1:art_1:rev_1:hash_1");
      expect(revision.changeSummary).toBe("Patch: Add renewal risks.");
      expect(revision.quality?.componentCount).toBe(4);
      expect(revision.graphArtifacts).toEqual({ setupSql: "-- setup" });
      expect(mockFetch.mock.calls.map(([url]) => url)).toEqual([
        "https://api.example.test/v1/artifacts?limit=10&offset=5",
        "https://api.example.test/v1/artifacts/art_1",
        "https://api.example.test/v1/artifacts/art_1/revisions?limit=3",
        "https://api.example.test/v1/artifacts/art_1/revisions/rev_1",
      ]);
    });

    it("updates artifact metadata without creating a revision", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            artifact: {
              artifactId: "art_1",
              userId: "user_1",
              currentVersion: "rev_1",
              title: "Customer health console",
              description: "Reusable account risk workspace",
              visibility: "org",
              createdAt: "2026-05-24T00:00:00Z",
              updatedAt: "2026-05-24T04:00:00Z",
            },
          },
        }),
      });

      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
      });

      const result = await tools.artifacts.update("art_1", {
        title: "Customer health console",
        description: "Reusable account risk workspace",
        visibility: "org",
      });

      expect(result.artifact).toMatchObject({
        artifactId: "art_1",
        title: "Customer health console",
        description: "Reusable account risk workspace",
        visibility: "org",
      });
      const [url, init] = mockFetch.mock.calls[0]!;
      expect(url).toBe("https://api.example.test/v1/artifacts/art_1");
      expect(init.method).toBe("PATCH");
      expect(JSON.parse(init.body as string)).toEqual({
        title: "Customer health console",
        description: "Reusable account risk workspace",
        visibility: "org",
      });
    });

    it("restores, forks, and exports artifact revisions", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              artifact: {
                artifactId: "art_1",
                currentRevisionId: "rev_restore",
              },
              revision: {
                revisionId: "rev_restore",
                parentRevisionId: "rev_2",
                operation: "restore",
              },
              restoredFrom: {
                artifactId: "art_1",
                revisionId: "rev_1",
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: {
              artifact: {
                artifactId: "art_fork",
                currentRevisionId: "rev_fork",
              },
              revision: {
                revisionId: "rev_fork",
                parentRevisionId: "rev_1",
                operation: "fork",
              },
              forkedFrom: {
                artifactId: "art_1",
                revisionId: "rev_1",
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            artifact: { artifactId: "art_1", currentVersion: "rev_1" },
            revision: { revisionId: "rev_1", operation: "patch" },
            export: {
              format: "montage.artifact.v1",
              exportedAt: "2026-05-24T00:00:00Z",
            },
            bundle: {
              ir: { kind: "shell" },
              contentHash: "hash_1",
              htmlBundleRef: "hosted-html:v1:art_1:rev_1:hash_1",
              graphArtifacts: { setupSql: "-- setup" },
              metadata: { operation: "patch" },
            },
          }),
        });

      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
      });

      const restored = await tools.artifacts.restore("art_1", "rev_1", {
        instruction: "Restore the stable CRM revision.",
      });
      const forked = await tools.artifacts.fork("art_1", {
        revisionId: "rev_1",
        instruction: "Fork for enterprise onboarding.",
      });
      const exported = await tools.artifacts.export("art_1", {
        revisionId: "rev_1",
      });

      expect(restored.restoredFrom).toEqual({
        artifactId: "art_1",
        revisionId: "rev_1",
      });
      expect(restored.revision.operation).toBe("restore");
      expect(forked.artifact.artifactId).toBe("art_fork");
      expect(forked.forkedFrom).toEqual({
        artifactId: "art_1",
        revisionId: "rev_1",
      });
      expect(exported.bundle.ir).toEqual({ kind: "shell" });
      expect(exported.bundle.htmlBundleRef).toBe(
        "hosted-html:v1:art_1:rev_1:hash_1",
      );
      expect(
        mockFetch.mock.calls.map(([url, init]) => [url, init?.method ?? "GET"]),
      ).toEqual([
        [
          "https://api.example.test/v1/artifacts/art_1/revisions/rev_1/restore",
          "POST",
        ],
        ["https://api.example.test/v1/artifacts/art_1/fork", "POST"],
        [
          "https://api.example.test/v1/artifacts/art_1/export?revisionId=rev_1",
          "GET",
        ],
      ]);
      expect(JSON.parse(String(mockFetch.mock.calls[0][1]?.body))).toEqual({
        instruction: "Restore the stable CRM revision.",
      });
      expect(JSON.parse(String(mockFetch.mock.calls[1][1]?.body))).toEqual({
        revisionId: "rev_1",
        instruction: "Fork for enterprise onboarding.",
      });
    });

    it("exports standalone HTML and portable archives", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => "<!doctype html><main>CRM</main>",
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            artifact: { artifactId: "art_1", currentVersion: "rev_1" },
            revision: { revisionId: "rev_1" },
            export: {
              format: "montage.artifact-archive.v1",
              exportedAt: "2026-05-24T00:00:00Z",
              files: [
                {
                  path: "artifact.json",
                  contentType: "application/vnd.montage.artifact.v1+json",
                  content: "{}",
                },
                {
                  path: "index.html",
                  contentType: "text/html; charset=utf-8",
                  content: "<!doctype html><main>CRM</main>",
                },
              ],
            },
          }),
        });

      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
      });

      const html = await tools.artifacts.exportHtml("art_1", {
        revisionId: "rev_1",
      });
      const archive = await tools.artifacts.exportArchive("art_1", {
        revisionId: "rev_1",
      });

      expect(html.artifactId).toBe("art_1");
      expect(html.revisionId).toBe("rev_1");
      expect(html.html).toContain("<main>CRM</main>");
      expect(archive.export.format).toBe("montage.artifact-archive.v1");
      expect(archive.export.files.map((file) => file.path)).toEqual([
        "artifact.json",
        "index.html",
      ]);
      expect(
        mockFetch.mock.calls.map(([url, init]) => [url, init?.method ?? "GET"]),
      ).toEqual([
        [
          "https://api.example.test/v1/artifacts/art_1/export?revisionId=rev_1&format=html",
          "GET",
        ],
        [
          "https://api.example.test/v1/artifacts/art_1/export?revisionId=rev_1&format=archive",
          "GET",
        ],
      ]);
    });

    it("rolls back and compares artifact revisions", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              artifact: {
                artifactId: "art_1",
                currentRevisionId: "rev_rollback",
              },
              revision: {
                revisionId: "rev_rollback",
                parentRevisionId: "rev_2",
                operation: "rollback",
              },
              rolledBackFrom: {
                artifactId: "art_1",
                revisionId: "rev_2",
              },
              restoredFrom: {
                artifactId: "art_1",
                revisionId: "rev_1",
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            artifactId: "art_1",
            baseRevision: {
              revisionId: "rev_1",
              contentHash: "hash_1",
            },
            targetRevision: {
              revisionId: "rev_2",
              contentHash: "hash_2",
              parentRevisionId: "rev_1",
            },
            comparison: {
              sameContent: false,
              sameHtmlBundle: false,
              sameDesignSystemVersion: true,
              operationChanged: true,
            },
          }),
        });

      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
      });

      const rollback = await tools.artifacts.rollback("art_1", {
        instruction: "Rollback the broken revision.",
      });
      const comparison = await tools.artifacts.compareRevisions("art_1", {
        baseRevisionId: "rev_1",
        targetRevisionId: "rev_2",
      });

      expect(rollback.revision.operation).toBe("rollback");
      expect(rollback.rolledBackFrom).toEqual({
        artifactId: "art_1",
        revisionId: "rev_2",
      });
      expect(rollback.restoredFrom).toEqual({
        artifactId: "art_1",
        revisionId: "rev_1",
      });
      expect(comparison.comparison.sameContent).toBe(false);
      expect(comparison.targetRevision.parentRevisionId).toBe("rev_1");
      expect(
        mockFetch.mock.calls.map(([url, init]) => [url, init?.method ?? "GET"]),
      ).toEqual([
        ["https://api.example.test/v1/artifacts/art_1/rollback", "POST"],
        [
          "https://api.example.test/v1/artifacts/art_1/revisions/compare?baseRevisionId=rev_1&targetRevisionId=rev_2",
          "GET",
        ],
      ]);
      expect(JSON.parse(String(mockFetch.mock.calls[0][1]?.body))).toEqual({
        instruction: "Rollback the broken revision.",
      });
    });

    it("creates, lists, and reads revision proof records", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: {
              proof: {
                proofId: "proof_1",
                artifactId: "art_1",
                revisionId: "rev_1",
                status: "passed",
                summary: "Desktop, mobile, and console checks passed.",
                checks: [{ id: "render", status: "passed" }],
                diagnostics: [],
                evidence: { screenshotUrl: "https://cdn.example/proof.png" },
                assets: [
                  {
                    assetId: "asset_1",
                    proofId: "proof_1",
                    artifactId: "art_1",
                    revisionId: "rev_1",
                    kind: "screenshot",
                    label: "Desktop screenshot",
                    filename: "desktop.png",
                    mimeType: "image/png",
                    byteLength: 9,
                    sha256: "hash",
                    metadata: { viewport: "desktop" },
                    url: "/v1/artifacts/art_1/revisions/rev_1/proofs/proof_1/assets/asset_1",
                    createdAt: "2026-05-24T00:00:00Z",
                  },
                ],
                createdByUserId: "user_1",
                createdAt: "2026-05-24T00:00:00Z",
              },
              revision: {
                revisionId: "rev_1",
                qaStatus: "passed",
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            artifactId: "art_1",
            revisionId: "rev_1",
            proofs: [
              {
                proofId: "proof_1",
                artifactId: "art_1",
                revisionId: "rev_1",
                status: "passed",
                assets: [
                  {
                    assetId: "asset_1",
                    proofId: "proof_1",
                    artifactId: "art_1",
                    revisionId: "rev_1",
                    kind: "screenshot",
                    label: "Desktop screenshot",
                    filename: "desktop.png",
                    mimeType: "image/png",
                    byteLength: 9,
                    sha256: "hash",
                    metadata: { viewport: "desktop" },
                    url: "/v1/artifacts/art_1/revisions/rev_1/proofs/proof_1/assets/asset_1",
                  },
                ],
              },
            ],
            limit: 10,
            offset: 0,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            artifactId: "art_1",
            revisionId: "rev_1",
            proof: {
              proofId: "proof_1",
              artifactId: "art_1",
              revisionId: "rev_1",
              status: "passed",
              assets: [
                {
                  assetId: "asset_1",
                  proofId: "proof_1",
                  artifactId: "art_1",
                  revisionId: "rev_1",
                  kind: "screenshot",
                  label: "Desktop screenshot",
                  filename: "desktop.png",
                  mimeType: "image/png",
                  byteLength: 9,
                  sha256: "hash",
                  metadata: { viewport: "desktop" },
                  url: "/v1/artifacts/art_1/revisions/rev_1/proofs/proof_1/assets/asset_1",
                },
              ],
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            artifactId: "art_1",
            revisionId: "rev_1",
            proofId: "proof_1",
            assets: [
              {
                assetId: "asset_1",
                proofId: "proof_1",
                artifactId: "art_1",
                revisionId: "rev_1",
                kind: "screenshot",
                label: "Desktop screenshot",
                filename: "desktop.png",
                mimeType: "image/png",
                byteLength: 9,
                sha256: "hash",
                metadata: { viewport: "desktop" },
                url: "/v1/artifacts/art_1/revisions/rev_1/proofs/proof_1/assets/asset_1",
              },
            ],
          }),
        });

      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
      });

      const created = await tools.artifacts.createProof("art_1", "rev_1", {
        status: "passed",
        summary: "Desktop, mobile, and console checks passed.",
        checks: [{ id: "render", status: "passed" }],
        evidence: { screenshotUrl: "https://cdn.example/proof.png" },
      });
      const list = await tools.artifacts.listProofs("art_1", "rev_1", {
        limit: 10,
      });
      const proof = await tools.artifacts.getProof("art_1", "rev_1", "proof_1");
      const assets = await tools.artifacts.listProofAssets(
        "art_1",
        "rev_1",
        "proof_1",
      );

      expect(created.proof.status).toBe("passed");
      expect(created.revision?.qaStatus).toBe("passed");
      expect(created.proof.assets?.[0]).toMatchObject({
        assetId: "asset_1",
        kind: "screenshot",
        url: "/v1/artifacts/art_1/revisions/rev_1/proofs/proof_1/assets/asset_1",
      });
      expect(list.proofs).toEqual([
        {
          proofId: "proof_1",
          artifactId: "art_1",
          revisionId: "rev_1",
          status: "passed",
          assets: [
            {
              assetId: "asset_1",
              proofId: "proof_1",
              artifactId: "art_1",
              revisionId: "rev_1",
              kind: "screenshot",
              label: "Desktop screenshot",
              filename: "desktop.png",
              mimeType: "image/png",
              byteLength: 9,
              sha256: "hash",
              metadata: { viewport: "desktop" },
              url: "/v1/artifacts/art_1/revisions/rev_1/proofs/proof_1/assets/asset_1",
            },
          ],
        },
      ]);
      expect(proof.proof.assets?.[0]?.filename).toBe("desktop.png");
      expect(proof.proof.proofId).toBe("proof_1");
      expect(assets.assets[0]).toMatchObject({
        assetId: "asset_1",
        url: "/v1/artifacts/art_1/revisions/rev_1/proofs/proof_1/assets/asset_1",
      });
      expect(
        mockFetch.mock.calls.map(([url, init]) => [url, init?.method ?? "GET"]),
      ).toEqual([
        [
          "https://api.example.test/v1/artifacts/art_1/revisions/rev_1/proofs",
          "POST",
        ],
        [
          "https://api.example.test/v1/artifacts/art_1/revisions/rev_1/proofs?limit=10",
          "GET",
        ],
        [
          "https://api.example.test/v1/artifacts/art_1/revisions/rev_1/proofs/proof_1",
          "GET",
        ],
        [
          "https://api.example.test/v1/artifacts/art_1/revisions/rev_1/proofs/proof_1/assets",
          "GET",
        ],
      ]);
      expect(JSON.parse(String(mockFetch.mock.calls[0][1]?.body))).toEqual({
        status: "passed",
        summary: "Desktop, mobile, and console checks passed.",
        checks: [{ id: "render", status: "passed" }],
        evidence: { screenshotUrl: "https://cdn.example/proof.png" },
      });
    });

    it("runs browser proof orchestration for a saved revision", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: {
            proof: {
              proofId: "proof_run_1",
              artifactId: "art_1",
              revisionId: "rev_1",
              status: "passed",
              summary: "Browser/runtime proof passed.",
              checks: [{ id: "browser:desktop", status: "passed" }],
              diagnostics: [],
              evidence: { kind: "montage.browser-runtime-proof.v1" },
              createdByUserId: "user_1",
              createdAt: "2026-05-24T00:00:00Z",
            },
            revision: {
              revisionId: "rev_1",
              qaStatus: "passed",
            },
          },
        }),
      });

      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
      });

      const result = await tools.artifacts.runProof("art_1", "rev_1", {
        targetUrl: "https://preview.example/art_1",
      });

      expect(result.proof.proofId).toBe("proof_run_1");
      expect(result.revision?.qaStatus).toBe("passed");
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe(
        "https://api.example.test/v1/artifacts/art_1/revisions/rev_1/proofs/run",
      );
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({
        targetUrl: "https://preview.example/art_1",
      });
    });

    it("patches and restyles artifacts through explicit lifecycle endpoints", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              artifact: { artifactId: "art_1", currentRevisionId: "rev_2" },
              revision: { revisionId: "rev_2", version: "hash_2" },
              generation: { id: "gen_patch", creditsUsed: 12 },
              html: "<main>Patched</main>",
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              artifact: { artifactId: "art_1", currentRevisionId: "rev_3" },
              revision: { revisionId: "rev_3", version: "hash_3" },
              generation: { id: "gen_style", creditsUsed: 8 },
              html: "<main>Restyled</main>",
            },
          }),
        });

      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
      });

      const patched = await tools.artifacts.patch("art_1", {
        instruction: "Add a renewal-risk tab.",
        baseRevisionId: "rev_1",
        mode: "signature_patch",
        constraints: { interactive: true },
      });
      const restyled = await tools.artifacts.restyle("art_1", {
        instruction: "Apply the Acme dark design system.",
        mode: "design_patch",
        designSystem: { theme: "dark", label: "Acme" },
      });

      expect(patched.revision?.revisionId).toBe("rev_2");
      expect(restyled.revision?.revisionId).toBe("rev_3");
      expect(mockFetch.mock.calls.map(([url]) => url)).toEqual([
        "https://api.example.test/v1/artifacts/art_1/patch",
        "https://api.example.test/v1/artifacts/art_1/restyle",
      ]);
      const patchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const restyleBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(patchBody).toEqual(
        expect.objectContaining({
          instruction: "Add a renewal-risk tab.",
          baseRevisionId: "rev_1",
          mode: "signature_patch",
          constraints: { interactive: true },
        }),
      );
      expect(restyleBody).toEqual(
        expect.objectContaining({
          instruction: "Apply the Acme dark design system.",
          mode: "design_patch",
          context: expect.objectContaining({
            designSystem: { theme: "dark", label: "Acme" },
          }),
        }),
      );
    });

    it("propagates artifact resource errors through MontageApiError", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({
          success: false,
          error: {
            code: "ARTIFACT_PERSISTENCE_FAILED",
            message: "Generation completed but did not persist an artifact.",
          },
        }),
      });

      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
      });

      await expect(
        tools.artifacts.create({ request: "Build a dashboard" }),
      ).rejects.toMatchObject({
        code: "ARTIFACT_PERSISTENCE_FAILED",
        status: 500,
      });
    });
  });

  describe("deployments", () => {
    it("creates pinned deployments through the M2 deployment resource endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: {
            deployment: {
              deploymentId: "dep_1",
              orgId: "org_1",
              artifactId: "art_1",
              revisionId: "rev_1",
              slug: "customer-health",
              mode: "share",
              status: "draft",
              cachePolicy: {
                scope: "public",
                maxAgeSeconds: 900,
                staleWhileRevalidateSeconds: 3600,
              },
              agentPolicy: {
                mode: "proxy",
                allowedActions: ["render_ui"],
              },
              hostedUrl: "https://api.example.test/a/deployments/dep_1",
              createdAt: "2026-05-24T00:00:00Z",
              updatedAt: "2026-05-24T00:00:00Z",
              promotedAt: null,
            },
          },
        }),
      });

      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
      });

      const deployment = await tools.deployments.create({
        artifactId: "art_1",
        revisionId: "rev_1",
        mode: "share",
        slug: "customer-health",
        auth: {
          type: "jwks",
          jwksUrl: "https://customer.example/.well-known/jwks.json",
        },
        bindings: { supabase: { url: "https://db.example" } },
        allowedOrigins: ["https://app.customer.example"],
        frameAncestors: ["https://embed.customer.example"],
        cachePolicy: {
          scope: "public",
          maxAgeSeconds: 900,
          staleWhileRevalidateSeconds: 3600,
        },
        proofPolicy: {
          mode: "allow-warnings",
          requiredCheckIds: ["render", "console"],
        },
        agentPolicy: {
          mode: "proxy",
          webhookUrl: "https://agent.acme.com/montage",
          allowedActions: ["render_ui"],
          timeoutMs: 15_000,
        },
      });

      expect(deployment).toMatchObject({
        deploymentId: "dep_1",
        artifactId: "art_1",
        revisionId: "rev_1",
        mode: "share",
        hostedUrl: "https://api.example.test/a/deployments/dep_1",
      });
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.example.test/v1/deployments");
      expect(opts.method).toBe("POST");
      expect(opts.headers["Authorization"]).toBe("Bearer sk_test");
      expect(JSON.parse(opts.body)).toEqual({
        artifactId: "art_1",
        revisionId: "rev_1",
        mode: "share",
        slug: "customer-health",
        auth: {
          type: "jwks",
          jwksUrl: "https://customer.example/.well-known/jwks.json",
        },
        bindings: { supabase: { url: "https://db.example" } },
        allowedOrigins: ["https://app.customer.example"],
        frameAncestors: ["https://embed.customer.example"],
        cachePolicy: {
          scope: "public",
          maxAgeSeconds: 900,
          staleWhileRevalidateSeconds: 3600,
        },
        proofPolicy: {
          mode: "allow-warnings",
          requiredCheckIds: ["render", "console"],
        },
        agentPolicy: {
          mode: "proxy",
          webhookUrl: "https://agent.acme.com/montage",
          allowedActions: ["render_ui"],
          timeoutMs: 15_000,
        },
      });
    });

    it("lists and reads deployments", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            deployments: [
              {
                deploymentId: "dep_1",
                artifactId: "art_1",
                revisionId: "rev_1",
                mode: "preview",
                status: "draft",
              },
            ],
            limit: 5,
            offset: 10,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            deploymentId: "dep_1",
            artifactId: "art_1",
            revisionId: "rev_1",
            mode: "preview",
            status: "draft",
          }),
        });

      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
      });

      const list = await tools.deployments.list({ limit: 5, offset: 10 });
      const detail = await tools.deployments.get("dep_1");

      expect(list).toEqual({
        deployments: [
          {
            deploymentId: "dep_1",
            artifactId: "art_1",
            revisionId: "rev_1",
            mode: "preview",
            status: "draft",
          },
        ],
        limit: 5,
        offset: 10,
      });
      expect(detail.deploymentId).toBe("dep_1");
      expect(mockFetch.mock.calls.map(([url]) => url)).toEqual([
        "https://api.example.test/v1/deployments?limit=5&offset=10",
        "https://api.example.test/v1/deployments/dep_1",
      ]);
    });

    it("promotes and revokes deployments", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              deployment: {
                deploymentId: "dep_1",
                artifactId: "art_1",
                revisionId: "rev_2",
                mode: "app",
                status: "active",
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              deployment: {
                deploymentId: "dep_1",
                artifactId: "art_1",
                revisionId: "rev_2",
                mode: "app",
                status: "revoked",
              },
            },
          }),
        });

      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
      });

      const promoted = await tools.deployments.promote("dep_1", {
        revisionId: "rev_2",
      });
      const revoked = await tools.deployments.revoke("dep_1");

      expect(promoted.status).toBe("active");
      expect(revoked.status).toBe("revoked");
      expect(mockFetch.mock.calls.map(([url]) => url)).toEqual([
        "https://api.example.test/v1/deployments/dep_1/promote",
        "https://api.example.test/v1/deployments/dep_1/revoke",
      ]);
      expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
        revisionId: "rev_2",
      });
      expect(mockFetch.mock.calls[1][1].body).toBeUndefined();
    });

    it("reads and invalidates deployment hosted bundle cache", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              cache: {
                deploymentId: "dep_1",
                artifactId: "art_1",
                revisionId: "rev_1",
                status: "warm",
                htmlBundleRef: "bundle-ref",
                bundle: {
                  ref: "bundle-ref",
                  contentHash: "hash-v1",
                  byteLength: 2048,
                  updatedAt: "2026-05-24T00:00:00Z",
                },
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              cache: {
                deploymentId: "dep_1",
                artifactId: "art_1",
                revisionId: "rev_1",
                status: "invalidated",
                htmlBundleRef: null,
                invalidatedRef: "bundle-ref",
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              cache: {
                deploymentId: "dep_1",
                artifactId: "art_1",
                revisionId: "rev_1",
                status: "warm",
                htmlBundleRef: "bundle-ref",
                prewarmed: true,
                bundle: {
                  ref: "bundle-ref",
                  contentHash: "hash-v1",
                  byteLength: 2048,
                  updatedAt: "2026-05-24T00:00:01Z",
                },
              },
            },
          }),
        });

      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
      });

      const cache = await tools.deployments.getCache("dep_1");
      const invalidated = await tools.deployments.invalidateCache("dep_1");
      const prewarmed = await tools.deployments.prewarmCache("dep_1");

      expect(cache).toMatchObject({
        deploymentId: "dep_1",
        status: "warm",
        htmlBundleRef: "bundle-ref",
        bundle: { byteLength: 2048 },
      });
      expect(invalidated).toMatchObject({
        deploymentId: "dep_1",
        status: "invalidated",
        invalidatedRef: "bundle-ref",
      });
      expect(prewarmed).toMatchObject({
        deploymentId: "dep_1",
        status: "warm",
        htmlBundleRef: "bundle-ref",
        prewarmed: true,
      });
      expect(mockFetch.mock.calls.map(([url]) => url)).toEqual([
        "https://api.example.test/v1/deployments/dep_1/cache",
        "https://api.example.test/v1/deployments/dep_1/cache/invalidate",
        "https://api.example.test/v1/deployments/dep_1/cache/prewarm",
      ]);
      expect(mockFetch.mock.calls[1][1].method).toBe("POST");
      expect(mockFetch.mock.calls[2][1].method).toBe("POST");
    });

    it("reads deployment capability usage", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            usage: {
              deploymentId: "dep_1",
              totals: {
                calls: 3,
                successes: 2,
                failures: 1,
                successRate: 2 / 3,
              },
              health: {
                status: "degraded",
                reasons: ["recent_failures"],
                failureRate: 1 / 3,
                avgLatencyMs: 35,
                lastErrorCode: "UPSTREAM_500",
              },
              capabilities: [
                {
                  capabilityName: "fetchPipeline",
                  calls: 2,
                  successes: 1,
                  failures: 1,
                  avgLatencyMs: 35,
                  lastCalledAt: "2026-05-24T03:00:00Z",
                  lastErrorCode: "UPSTREAM_500",
                  health: {
                    status: "failing",
                    reasons: ["failure_rate_high"],
                    failureRate: 0.5,
                    avgLatencyMs: 35,
                    lastErrorCode: "UPSTREAM_500",
                  },
                },
              ],
              recentEvents: [
                {
                  capabilityName: "fetchPipeline",
                  effect: "query",
                  source: "deployment-proxy",
                  latencyMs: 50,
                  success: false,
                  errorCode: "UPSTREAM_500",
                  createdAt: "2026-05-24T03:00:00Z",
                },
              ],
            },
          },
        }),
      });

      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
      });

      const usage = await tools.deployments.getCapabilityUsage("dep_1", {
        limit: 2,
        since: "2026-05-24T02:00:00Z",
      });

      expect(usage).toMatchObject({
        deploymentId: "dep_1",
        totals: {
          calls: 3,
          successes: 2,
          failures: 1,
        },
        health: {
          status: "degraded",
          reasons: ["recent_failures"],
          failureRate: 1 / 3,
        },
        capabilities: [
          {
            capabilityName: "fetchPipeline",
            calls: 2,
            failures: 1,
            health: {
              status: "failing",
              reasons: ["failure_rate_high"],
            },
          },
        ],
      });
      expect(mockFetch.mock.calls.map(([url]) => url)).toEqual([
        "https://api.example.test/v1/deployments/dep_1/capabilities/usage?limit=2&since=2026-05-24T02%3A00%3A00Z",
      ]);
    });

    it("reads deployment agent-action usage", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            usage: {
              deploymentId: "dep_1",
              totals: {
                calls: 4,
                successes: 3,
                failures: 1,
                successRate: 3 / 4,
              },
              health: {
                status: "degraded",
                reasons: ["recent_failures"],
                failureRate: 1 / 4,
                avgLatencyMs: 80,
                lastErrorCode: "UPSTREAM_500",
              },
              actions: [
                {
                  action: "render_ui",
                  calls: 3,
                  successes: 2,
                  failures: 1,
                  avgLatencyMs: 80,
                  lastCalledAt: "2026-05-24T04:00:00Z",
                  lastErrorCode: "UPSTREAM_500",
                  health: {
                    status: "degraded",
                    reasons: ["recent_failures"],
                    failureRate: 1 / 3,
                    avgLatencyMs: 80,
                    lastErrorCode: "UPSTREAM_500",
                  },
                },
              ],
              recentEvents: [
                {
                  action: "render_ui",
                  mode: "proxy",
                  source: "deployment-agent-proxy",
                  latencyMs: 120,
                  success: false,
                  errorCode: "UPSTREAM_500",
                  createdAt: "2026-05-24T04:00:00Z",
                },
              ],
            },
          },
        }),
      });

      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
      });

      const usage = await tools.deployments.getAgentActionUsage("dep_1", {
        limit: 2,
        since: "2026-05-24T02:00:00Z",
      });

      expect(usage).toMatchObject({
        deploymentId: "dep_1",
        totals: {
          calls: 4,
          successes: 3,
          failures: 1,
        },
        health: {
          status: "degraded",
          reasons: ["recent_failures"],
          failureRate: 1 / 4,
        },
        actions: [
          {
            action: "render_ui",
            calls: 3,
            failures: 1,
            health: {
              status: "degraded",
              reasons: ["recent_failures"],
            },
          },
        ],
      });
      expect(mockFetch.mock.calls.map(([url]) => url)).toEqual([
        "https://api.example.test/v1/deployments/dep_1/agent-actions/usage?limit=2&since=2026-05-24T02%3A00%3A00Z",
      ]);
    });

    it("updates deployment configuration through PATCH", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            deployment: {
              deploymentId: "dep_1",
              artifactId: "art_1",
              revisionId: "rev_2",
              slug: "customer-health-embed",
              mode: "embed",
              status: "active",
            },
          },
        }),
      });

      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
      });

      const updated = await tools.deployments.update("dep_1", {
        mode: "embed",
        slug: "customer-health-embed",
        auth: { type: "none" },
        bindings: { supabase: { url: "https://db.example" } },
        allowedOrigins: ["https://app.example"],
        frameAncestors: ["https://embed.example"],
        cachePolicy: {
          scope: "no-store",
          maxAgeSeconds: 0,
          staleWhileRevalidateSeconds: 0,
        },
        proofPolicy: {
          mode: "manual",
          allowFailedChecks: true,
        },
        agentPolicy: {
          mode: "disabled",
        },
      });

      expect(updated).toMatchObject({
        deploymentId: "dep_1",
        mode: "embed",
        slug: "customer-health-embed",
      });
      expect(mockFetch.mock.calls[0][0]).toBe(
        "https://api.example.test/v1/deployments/dep_1",
      );
      expect(mockFetch.mock.calls[0][1].method).toBe("PATCH");
      expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
        mode: "embed",
        slug: "customer-health-embed",
        auth: { type: "none" },
        bindings: { supabase: { url: "https://db.example" } },
        allowedOrigins: ["https://app.example"],
        frameAncestors: ["https://embed.example"],
        cachePolicy: {
          scope: "no-store",
          maxAgeSeconds: 0,
          staleWhileRevalidateSeconds: 0,
        },
        proofPolicy: {
          mode: "manual",
          allowFailedChecks: true,
        },
        agentPolicy: {
          mode: "disabled",
        },
      });
    });

    it("propagates deployment resource errors through MontageApiError", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          success: false,
          error: {
            code: "ORG_CONTEXT_REQUIRED",
            message: "Deployment resources require an org-scoped API key.",
          },
        }),
      });

      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
      });

      await expect(
        tools.deployments.create({ artifactId: "art_1" }),
      ).rejects.toMatchObject({
        code: "ORG_CONTEXT_REQUIRED",
        status: 400,
      });
    });
  });

  describe("openai", () => {
    it("returns an array with one tool definition", () => {
      const tools = createMontageTools({ apiKey: "sk_test" });
      const defs = tools.openai();
      expect(defs).toHaveLength(1);
    });

    it("tool definition has type function", () => {
      const tools = createMontageTools({ apiKey: "sk_test" });
      const [def] = tools.openai();
      expect(def.type).toBe("function");
    });

    it("function has name montage_generate, description, and parameters", () => {
      const tools = createMontageTools({ apiKey: "sk_test" });
      const [def] = tools.openai();
      expect(def.function.name).toBe("montage_generate");
      expect(def.function).toHaveProperty("description");
      expect(def.function).toHaveProperty("parameters");
    });

    it("parameters matches the same schema as anthropic input_schema", () => {
      const tools = createMontageTools({ apiKey: "sk_test" });
      const [anthropicDef] = tools.anthropic();
      const [openaiDef] = tools.openai();
      expect(openaiDef.function.parameters).toEqual(anthropicDef.input_schema);
    });
  });

  describe("execute", () => {
    it("calls fetch with POST to the default generate endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "gen_abc",
          html: "<div>ok</div>",
          creditsUsed: 1,
        }),
      });

      const tools = createMontageTools({ apiKey: "sk_test" });
      await tools.execute({ prompt: "dashboard", dataInfo: '{"rows":[]}' });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.usemontage.ai/v1/generate");
      expect(opts.method).toBe("POST");
    });

    it("sends Authorization and Content-Type headers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gen_abc", html: "<div/>", creditsUsed: 1 }),
      });

      const tools = createMontageTools({ apiKey: "sk_secret_123" });
      await tools.execute({ prompt: "test", dataInfo: "{}" });

      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers["Authorization"]).toBe("Bearer sk_secret_123");
      expect(opts.headers["Content-Type"]).toBe("application/json");
    });

    it("sends prompt and dataInfo in the body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gen_1", html: "<p/>", creditsUsed: 1 }),
      });

      const tools = createMontageTools({ apiKey: "sk_test" });
      await tools.execute({
        prompt: "my prompt",
        dataInfo: '{"key":"value"}',
      });

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.prompt).toBe("my prompt");
      expect(body.dataInfo).toBe('{"key":"value"}');
    });

    it("sends OpenAI-style input when prompt is omitted", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gen_1", html: "<p/>", creditsUsed: 1 }),
      });

      const tools = createMontageTools({ apiKey: "sk_test" });
      await tools.execute({
        input: "my app request",
        dataInfo: '{"key":"value"}',
      });

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body).not.toHaveProperty("prompt");
      expect(body.input).toBe("my app request");
      expect(body.dataInfo).toBe('{"key":"value"}');
    });

    it("adds a generated requestId when one is not provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gen_1", html: "<p/>", creditsUsed: 1 }),
      });

      const tools = createMontageTools({ apiKey: "sk_test" });
      await tools.execute({
        prompt: "my prompt",
        dataInfo: "{}",
      });

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(typeof body.requestId).toBe("string");
      expect(body.requestId.length).toBeGreaterThan(5);
      expect(body.requestId.startsWith("mtg_")).toBe(true);
    });

    it("sanitizes caller-provided requestId values", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gen_1", html: "<p/>", creditsUsed: 1 }),
      });

      const tools = createMontageTools({ apiKey: "sk_test" });
      await tools.execute({
        prompt: "sanitize id",
        dataInfo: "{}",
        requestId: "  a bad/id with spaces  ",
      });

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.requestId).toBe("a_bad_id_with_spaces");
    });

    it("forwards an optional title in the generate body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gen_1", html: "<p/>", creditsUsed: 1 }),
      });

      const tools = createMontageTools({ apiKey: "sk_test" });
      await tools.execute({
        prompt: "compare laptops",
        title: "MacBook Pro vs Dell XPS",
        dataInfo: "{}",
      });

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.title).toBe("MacBook Pro vs Dell XPS");
    });

    it("returns id, html, and creditsUsed from the API response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "gen_test123",
          html: "<section>test</section>",
          creditsUsed: 2,
        }),
      });

      const tools = createMontageTools({ apiKey: "sk_test" });
      const result = await tools.execute({ prompt: "prompt", dataInfo: "{}" });

      expect(result).toEqual({
        id: "gen_test123",
        html: "<section>test</section>",
        creditsUsed: 2,
      });
    });

    it("sends adapterManifest derived from adapter.getCapabilityManifest()", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gen_1", html: "<html/>", creditsUsed: 1 }),
      });

      const adapter = createMontageAdapter({
        agent: { id: "test-agent", name: "Test Agent" },
        capabilities: [
          {
            name: "fetchUsers",
            effect: "query",
            description: "Fetch users for a table.",
          },
        ],
        invokeCapability: async () => ({ data: [] }),
      });
      const tools = createMontageTools({ apiKey: "sk_test" });

      await tools.execute({
        prompt: "users table",
        dataInfo: "{}",
        adapter,
      });

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.adapterManifest).toEqual({
        capabilities: [
          expect.objectContaining({
            name: "fetchUsers",
            effect: "query",
            availability: "adapter",
          }),
        ],
      });
    });

    it("forwards artifactId for evolve requests", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gen_1", html: "<html/>", creditsUsed: 1 }),
      });

      const tools = createMontageTools({ apiKey: "sk_test" });
      await tools.execute({
        prompt: "revise artifact",
        dataInfo: "{}",
        artifactId: "a1",
      });

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.artifactId).toBe("a1");
    });

    it("forwards hosted and strict data contract fields", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "gen_1",
          html: "<html/>",
          creditsUsed: 1,
          hostedUrl: "https://api.usemontage.ai/a/a1",
        }),
      });

      const tools = createMontageTools({ apiKey: "sk_test" });
      const result = await tools.execute({
        prompt: "investor dashboard",
        dataInfo: "Investor rows include firm and partner.",
        data: { investors: [{ firm: "Northstar", partner: "Maya" }] },
        hosted: true,
        strictData: true,
        requiredFields: ["firm", "partner"],
        requiredCapabilities: ["fetchInvestors"],
      });

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body).toEqual(
        expect.objectContaining({
          hosted: true,
          strictData: true,
          data: { investors: [{ firm: "Northstar", partner: "Maya" }] },
          requiredFields: ["firm", "partner"],
          requiredCapabilities: ["fetchInvestors"],
        }),
      );
      expect(result.hostedUrl).toBe("https://api.usemontage.ai/a/a1");
    });

    it("returns artifactId, version, and resolution from the API response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "gen_1",
          html: "<html/>",
          creditsUsed: 0,
          artifactId: "a1",
          version: "v1",
          resolution: { kind: "exact", path: "graph", durationMs: 12 },
        }),
      });

      const tools = createMontageTools({ apiKey: "sk_test" });
      const result = await tools.execute({
        prompt: "cached artifact",
        dataInfo: "{}",
      });

      expect(result).toEqual({
        id: "gen_1",
        html: "<html/>",
        creditsUsed: 0,
        artifactId: "a1",
        version: "v1",
        resolution: { kind: "exact", path: "graph", durationMs: 12 },
      });
    });

    it("accepts bundled artifact HTML from the API response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "gen_bundle",
          artifact: {
            html: "<!DOCTYPE html><html><body><section>bundle</section></body></html>",
          },
          creditsUsed: 4,
        }),
      });

      const tools = createMontageTools({ apiKey: "sk_test" });
      const result = await tools.execute({ prompt: "prompt", dataInfo: "{}" });

      expect(result).toEqual({
        id: "gen_bundle",
        html: "<!DOCTYPE html><html><body><section>bundle</section></body></html>",
        creditsUsed: 4,
      });
    });

    it("uses custom apiUrl when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gen_1", html: "<p/>", creditsUsed: 1 }),
      });

      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://custom.example.com",
      });
      await tools.execute({ prompt: "prompt", dataInfo: "{}" });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://custom.example.com/v1/generate");
    });

    it("does not strip trailing slashes from apiUrl (appends path directly)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gen_1", html: "<p/>", creditsUsed: 1 }),
      });

      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://custom.example.com/",
      });
      await tools.execute({ prompt: "prompt", dataInfo: "{}" });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://custom.example.com//v1/generate");
    });

    it("includes config.defaults.designSystem in the request body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gen_1", html: "<p/>", creditsUsed: 1 }),
      });

      const tools = createMontageTools({
        apiKey: "sk_test",
        defaults: {
          designSystem: { theme: "dark", label: "Brand" },
        },
      });
      await tools.execute({ prompt: "prompt", dataInfo: "{}" });

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.designSystem).toEqual({ theme: "dark", label: "Brand" });
    });

    it("per-call designSystem overrides default fields via shallow merge", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gen_1", html: "<p/>", creditsUsed: 1 }),
      });

      const tools = createMontageTools({
        apiKey: "sk_test",
        defaults: {
          designSystem: { theme: "dark", label: "Brand", mood: "professional" },
        },
      });
      await tools.execute({
        prompt: "prompt",
        dataInfo: "{}",
        designSystem: { theme: "light", palette: "Minimal" },
      });

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.designSystem.theme).toBe("light");
      expect(body.designSystem.palette).toBe("Minimal");
      expect(body.designSystem.label).toBe("Brand");
      expect(body.designSystem.mood).toBe("professional");
    });

    it("deep-merges colors from default and per-call designSystem", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gen_1", html: "<p/>", creditsUsed: 1 }),
      });

      const tools = createMontageTools({
        apiKey: "sk_test",
        defaults: {
          designSystem: {
            colors: { primary: "#ff0000", background: "#000000" },
          },
        },
      });
      await tools.execute({
        prompt: "prompt",
        dataInfo: "{}",
        designSystem: {
          colors: { primary: "#00ff00", text: "#ffffff" },
        },
      });

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.designSystem.colors).toEqual({
        primary: "#00ff00",
        background: "#000000",
        text: "#ffffff",
      });
    });

    it("includes config.defaults.renderSurface in the request body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gen_1", html: "<p/>", creditsUsed: 1 }),
      });

      const tools = createMontageTools({
        apiKey: "sk_test",
        defaults: {
          renderSurface: { width: 800, height: 600, devicePixelRatio: 2 },
        },
      });
      await tools.execute({ prompt: "prompt", dataInfo: "{}" });

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.renderSurface).toEqual({
        width: 800,
        height: 600,
        devicePixelRatio: 2,
      });
    });

    it("omits designSystem from the body when not in defaults or input", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gen_1", html: "<p/>", creditsUsed: 1 }),
      });

      const tools = createMontageTools({ apiKey: "sk_test" });
      await tools.execute({ prompt: "prompt", dataInfo: "{}" });

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body).not.toHaveProperty("designSystem");
    });

    it("throws MontageApiError with correct code, status, and message on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        json: async () => ({
          code: "GENERATION_REQUIRES_SECRET_KEY",
          message: "Requires sk key",
        }),
      });

      const tools = createMontageTools({ apiKey: "sk_test" });

      try {
        await tools.execute({ prompt: "p", dataInfo: "{}" });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(MontageApiError);
        const apiErr = err as MontageApiError;
        expect(apiErr.code).toBe("GENERATION_REQUIRES_SECRET_KEY");
        expect(apiErr.status).toBe(403);
        expect(apiErr.message).toBe("Requires sk key");
      }
    });

    it("propagates nested error.code from API responses (envelope shape)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({
          success: false,
          error: { code: "INVALID_API_KEY", message: "Invalid API key" },
        }),
      });

      const tools = createMontageTools({ apiKey: "sk_invalid" });

      try {
        await tools.execute({ prompt: "p", dataInfo: "{}" });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(MontageApiError);
        const apiErr = err as MontageApiError;
        expect(apiErr.code).toBe("INVALID_API_KEY");
        expect(apiErr.status).toBe(401);
        expect(apiErr.message).toBe("Invalid API key");
      }
    });

    it("throws MontageApiError with fallback message on non-JSON error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
        json: async () => {
          throw new Error("not json");
        },
      });

      const tools = createMontageTools({ apiKey: "sk_test" });

      try {
        await tools.execute({ prompt: "p", dataInfo: "{}" });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(MontageApiError);
        const apiErr = err as MontageApiError;
        expect(apiErr.code).toBe("api_error");
        expect(apiErr.status).toBe(502);
        expect(apiErr.message).toContain("502");
        expect(apiErr.message).toContain("Bad Gateway");
      }
    });

    it("throws MontageApiError with code 'network' and status 0 on fetch failure", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      const tools = createMontageTools({ apiKey: "sk_test" });

      try {
        await tools.execute({ prompt: "p", dataInfo: "{}" });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(MontageApiError);
        const apiErr = err as MontageApiError;
        expect(apiErr.code).toBe("network");
        expect(apiErr.status).toBe(0);
        expect(apiErr.message).toContain("Failed to fetch");
      }
    });
  });

  describe("designSystems", () => {
    it("creates, lists, reads, updates, forks, and imports org design systems", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: {
              designSystem: {
                designSystemId: "ds_1",
                orgId: "org_1",
                name: "Acme Dark",
                currentVersionId: "dsv_1",
              },
              version: {
                versionId: "dsv_1",
                designSystemId: "ds_1",
                tokens: { label: "Acme Dark", theme: "dark" },
                source: { kind: "brief" },
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            designSystems: [
              {
                designSystemId: "ds_1",
                name: "Acme Dark",
                currentVersionId: "dsv_1",
              },
            ],
            limit: 10,
            offset: 0,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            designSystem: {
              designSystemId: "ds_1",
              name: "Acme Dark",
              currentVersionId: "dsv_1",
            },
            currentVersion: {
              versionId: "dsv_1",
              designSystemId: "ds_1",
              tokens: { label: "Acme Dark", theme: "dark" },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              designSystem: {
                designSystemId: "ds_1",
                name: "Acme Light",
                currentVersionId: "dsv_2",
              },
              version: {
                versionId: "dsv_2",
                designSystemId: "ds_1",
                tokens: { label: "Acme Light", theme: "light" },
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: {
              designSystem: {
                designSystemId: "ds_2",
                name: "Acme Partner",
                currentVersionId: "dsv_fork",
              },
              version: {
                versionId: "dsv_fork",
                designSystemId: "ds_2",
                tokens: { label: "Acme Dark", theme: "dark" },
              },
              forkedFrom: {
                designSystemId: "ds_1",
                versionId: "dsv_1",
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: {
              designSystem: {
                designSystemId: "ds_3",
                name: "Imported",
                currentVersionId: "dsv_import",
              },
              version: {
                versionId: "dsv_import",
                designSystemId: "ds_3",
                source: { kind: "brief" },
                tokens: { label: "Imported", palette: "Monochrome" },
              },
            },
          }),
        });

      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
      });

      const created = await tools.designSystems.create({
        name: "Acme Dark",
        designSystem: { label: "Acme Dark", theme: "dark" },
      });
      const list = await tools.designSystems.list({ limit: 10 });
      const detail = await tools.designSystems.get("ds_1");
      const updated = await tools.designSystems.update("ds_1", {
        name: "Acme Light",
        designSystem: { label: "Acme Light", theme: "light" },
      });
      const forked = await tools.designSystems.fork("ds_1", {
        name: "Acme Partner",
        versionId: "dsv_1",
      });
      const imported = await tools.designSystems.import({
        name: "Imported",
        source: {
          kind: "brief",
          description: "Use a monochrome SaaS dashboard style.",
        },
        designSystem: { label: "Imported", palette: "Monochrome" },
      });

      expect(created.version?.tokens).toEqual({
        label: "Acme Dark",
        theme: "dark",
      });
      expect(list.designSystems).toEqual([
        {
          designSystemId: "ds_1",
          name: "Acme Dark",
          currentVersionId: "dsv_1",
        },
      ]);
      expect(detail.currentVersion?.versionId).toBe("dsv_1");
      expect(updated.designSystem.name).toBe("Acme Light");
      expect(forked.forkedFrom).toEqual({
        designSystemId: "ds_1",
        versionId: "dsv_1",
      });
      expect(imported.designSystem.designSystemId).toBe("ds_3");
      expect(
        mockFetch.mock.calls.map(([url, init]) => [url, init?.method ?? "GET"]),
      ).toEqual([
        ["https://api.example.test/v1/design-systems", "POST"],
        ["https://api.example.test/v1/design-systems?limit=10", "GET"],
        ["https://api.example.test/v1/design-systems/ds_1", "GET"],
        ["https://api.example.test/v1/design-systems/ds_1", "PATCH"],
        ["https://api.example.test/v1/design-systems/ds_1/fork", "POST"],
        ["https://api.example.test/v1/design-systems/import", "POST"],
      ]);
      expect(JSON.parse(String(mockFetch.mock.calls[0][1]?.body))).toEqual({
        name: "Acme Dark",
        designSystem: { label: "Acme Dark", theme: "dark" },
      });
      expect(JSON.parse(String(mockFetch.mock.calls[4][1]?.body))).toEqual({
        name: "Acme Partner",
        versionId: "dsv_1",
      });
    });
  });

  describe("templates", () => {
    it("creates, lists, reads, and forks reusable artifact templates", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: {
              template: {
                templateId: "tpl_1",
                orgId: "org_1",
                artifactId: "art_1",
                revisionId: "rev_1",
                name: "Renewal Risk Dashboard",
                description: "Reusable CS dashboard",
                tags: ["customer-success", "dashboard"],
                visibility: "org",
                metadata: { kind: "dashboard" },
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            templates: [
              {
                templateId: "tpl_1",
                artifactId: "art_1",
                revisionId: "rev_1",
                name: "Renewal Risk Dashboard",
                tags: ["customer-success", "dashboard"],
                visibility: "org",
              },
            ],
            limit: 10,
            offset: 0,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            template: {
              templateId: "tpl_1",
              artifactId: "art_1",
              revisionId: "rev_1",
              name: "Renewal Risk Dashboard",
              tags: ["customer-success", "dashboard"],
              visibility: "org",
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: {
              template: {
                templateId: "tpl_1",
                artifactId: "art_1",
                revisionId: "rev_1",
              },
              artifact: {
                artifactId: "art_2",
                currentRevisionId: "rev_2",
              },
              revision: {
                revisionId: "rev_2",
                parentRevisionId: "rev_1",
                operation: "fork",
              },
              forkedFrom: {
                artifactId: "art_1",
                revisionId: "rev_1",
              },
            },
          }),
        });

      const tools = createMontageTools({
        apiKey: "sk_test",
        apiUrl: "https://api.example.test",
      });

      const created = await tools.templates.create({
        artifactId: "art_1",
        revisionId: "rev_1",
        name: "Renewal Risk Dashboard",
        description: "Reusable CS dashboard",
        tags: ["customer-success", "dashboard"],
        visibility: "org",
        metadata: { kind: "dashboard" },
      });
      const list = await tools.templates.list({ limit: 10 });
      const detail = await tools.templates.get("tpl_1");
      const forked = await tools.templates.fork("tpl_1", {
        instruction: "Create a partner-facing copy.",
      });

      expect(created.template.name).toBe("Renewal Risk Dashboard");
      expect(list.templates[0]?.templateId).toBe("tpl_1");
      expect(detail.template.revisionId).toBe("rev_1");
      expect(forked.artifact.artifactId).toBe("art_2");
      expect(forked.forkedFrom).toEqual({
        artifactId: "art_1",
        revisionId: "rev_1",
      });
      expect(
        mockFetch.mock.calls.map(([url, init]) => [url, init?.method ?? "GET"]),
      ).toEqual([
        ["https://api.example.test/v1/templates", "POST"],
        ["https://api.example.test/v1/templates?limit=10", "GET"],
        ["https://api.example.test/v1/templates/tpl_1", "GET"],
        ["https://api.example.test/v1/templates/tpl_1/fork", "POST"],
      ]);
      expect(JSON.parse(String(mockFetch.mock.calls[0][1]?.body))).toEqual({
        artifactId: "art_1",
        revisionId: "rev_1",
        name: "Renewal Risk Dashboard",
        description: "Reusable CS dashboard",
        tags: ["customer-success", "dashboard"],
        visibility: "org",
        metadata: { kind: "dashboard" },
      });
      expect(JSON.parse(String(mockFetch.mock.calls[3][1]?.body))).toEqual({
        instruction: "Create a partner-facing copy.",
      });
    });
  });

  describe("stream", () => {
    it("MontageStreamOptions accepts adapter, context, and onCapabilityError", () => {
      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const adapter = createMontageAdapter({
        agent: { id: "test-agent", name: "Test Agent" },
        capabilities: [
          {
            name: "fetchUsers",
            effect: "query",
            description: "Fetch users for a table.",
          },
        ],
      });

      const options: MontageStreamOptions = {
        target,
        adapter,
        context: { userId: "u1" },
        onCapabilityError: () => {},
      };

      expect(options.context).toEqual({ userId: "u1" });
    });

    it("sends adapterManifest derived from stream options adapter", async () => {
      mockFetch.mockResolvedValueOnce(
        createSseResponse([
          {
            type: "done",
            html: "<!doctype html><html><body>Final</body></html>",
            id: "gen_stream",
          },
        ]),
      );

      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const adapter = createMontageAdapter({
        agent: { id: "test-agent", name: "Test Agent" },
        capabilities: [
          {
            name: "fetchUsers",
            effect: "query",
            description: "Fetch users for a table.",
          },
        ],
      });
      const tools = createMontageTools({ apiKey: "sk_test" });

      await tools.stream(
        { prompt: "stream users", dataInfo: "{}" },
        { target, adapter },
      );

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.adapterManifest).toEqual({
        capabilities: [
          expect.objectContaining({
            name: "fetchUsers",
            effect: "query",
            availability: "adapter",
          }),
        ],
      });
    });

    it("adds a generated requestId to stream requests by default", async () => {
      mockFetch.mockResolvedValueOnce(
        createSseResponse([
          {
            type: "done",
            html: "<!doctype html><html><body>Final</body></html>",
            id: "gen_stream",
          },
        ]),
      );

      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const tools = createMontageTools({ apiKey: "sk_test" });

      await tools.stream(
        { prompt: "stream users", dataInfo: "{}" },
        { target },
      );

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(typeof body.requestId).toBe("string");
      expect(body.requestId.startsWith("mtg_")).toBe(true);
    });

    it("mounts shell, applies slots, and replaces with final HTML", async () => {
      mockFetch.mockResolvedValueOnce(
        createSseResponse([
          { type: "status", text: "Generating..." },
          {
            type: "shell",
            html: '<!doctype html><html><body><main data-mtg-stream-slots><section data-mtg-stream-slot="section-1">Loading</section></main></body></html>',
          },
          {
            type: "slot",
            slot: "section-1",
            html: "<article>Progressive slot</article>",
          },
          {
            type: "done",
            html: "<!doctype html><html><body><strong>Final artifact</strong></body></html>",
            id: "gen_stream",
            creditsUsed: 3,
            cacheKey: "final:abc",
          },
        ]),
      );

      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const observed: string[] = [];
      const tools = createMontageTools({ apiKey: "sk_test" });

      const result = await tools.stream(
        { prompt: "compare", dataInfo: "{}" },
        {
          target,
          onStatus: (text) => observed.push(`status:${text}`),
          onEvent: (event) => {
            if (event.type === "shell") {
              observed.push(`shell:${target.textContent?.trim()}`);
            }
            if (event.type === "slot") {
              observed.push(`slot:${target.textContent?.trim()}`);
            }
          },
        },
      );

      expect(observed).toEqual([
        "status:Generating...",
        "shell:Loading",
        "slot:Progressive slot",
      ]);
      expect(target.innerHTML).toContain("Final artifact");
      expect(result).toMatchObject({
        id: "gen_stream",
        html: "<!doctype html><html><body><strong>Final artifact</strong></body></html>",
        creditsUsed: 3,
        cacheKey: "final:abc",
      });
      result.cleanup();
      expect(target.innerHTML).toBe("");
    });

    it("returns the last streamed preview when the stream ends after metadata without final HTML", async () => {
      mockFetch.mockResolvedValueOnce(
        createSseResponse([
          {
            type: "shell",
            html: '<!doctype html><html><body><main data-mtg-stream-slots><section data-mtg-stream-slot="section-1">Loading</section></main></body></html>',
          },
          {
            type: "slot",
            slot: "section-1",
            html: "<article>Recovered preview</article>",
          },
          {
            type: "artifact",
            artifactId: "artifact_stream",
            version: "version_stream",
          },
        ]),
      );

      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const tools = createMontageTools({ apiKey: "sk_test" });

      const result = await tools.stream(
        { prompt: "recover preview", dataInfo: "{}" },
        { target },
      );

      expect(result.html).toContain("Recovered preview");
      expect(result.artifactId).toBe("artifact_stream");
      expect(result.version).toBe("version_stream");
      expect(target.innerHTML).toContain("Recovered preview");
    });

    it("returns the last streamed preview when a terminal error arrives after rendered slots", async () => {
      mockFetch.mockResolvedValueOnce(
        createSseResponse([
          {
            type: "shell",
            html: '<!doctype html><html><body><main data-mtg-stream-slots><section data-mtg-stream-slot="section-1">Loading</section></main></body></html>',
          },
          {
            type: "slot",
            slot: "section-1",
            html: "<article>Final streamed blob</article>",
          },
          {
            type: "artifact",
            artifactId: "artifact_stream",
            version: "version_stream",
          },
          {
            type: "error",
            text: "Late renderer finalize error",
          },
        ]),
      );

      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const onDone = vi.fn();
      const onError = vi.fn();
      const tools = createMontageTools({ apiKey: "sk_test" });

      const result = await tools.stream(
        { prompt: "recover terminal error", dataInfo: "{}" },
        { target, onDone, onError },
      );

      expect(result.html).toContain("Final streamed blob");
      expect(result.artifactId).toBe("artifact_stream");
      expect(result.version).toBe("version_stream");
      expect(result.diagnostics).toEqual([
        expect.objectContaining({
          code: "stream-preview-fallback",
          severity: "warning",
          message: expect.stringContaining("Late renderer finalize error"),
        }),
      ]);
      expect(target.innerHTML).toContain("Final streamed blob");
      expect(onDone).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining("Final streamed blob"),
          artifactId: "artifact_stream",
          version: "version_stream",
        }),
      );
      expect(onError).not.toHaveBeenCalled();
    });

    it("keeps the final streamed artifact when a late error arrives after done", async () => {
      mockFetch.mockResolvedValueOnce(
        createSseResponse([
          {
            type: "shell",
            html: '<!doctype html><html><body><main data-mtg-stream-slots><section data-mtg-stream-slot="section-1">Loading</section></main></body></html>',
          },
          {
            type: "slot",
            slot: "section-1",
            html: "<article>Progressive blob</article>",
          },
          {
            type: "done",
            html: "<!doctype html><html><body><strong>Final streamed blob</strong></body></html>",
            id: "gen_final",
            artifactId: "artifact_final",
            version: "version_final",
            htmlBundleRef:
              "hosted-html:v1:artifact_final:revision_final:hash_final",
          },
          {
            type: "error",
            text: "Late finalize error",
          },
        ]),
      );

      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const onDone = vi.fn();
      const onError = vi.fn();
      const tools = createMontageTools({ apiKey: "sk_test" });

      const result = await tools.stream(
        { prompt: "late error after done", dataInfo: "{}" },
        { target, onDone, onError },
      );

      expect(result.html).toContain("Final streamed blob");
      expect(result.artifactId).toBe("artifact_final");
      expect(result.version).toBe("version_final");
      expect(result.htmlBundleRef).toBe(
        "hosted-html:v1:artifact_final:revision_final:hash_final",
      );
      expect(result.diagnostics).toBeUndefined();
      expect(target.innerHTML).toContain("Final streamed blob");
      expect(target.innerHTML).not.toContain("Progressive blob");
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onDone).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "gen_final",
          html: expect.stringContaining("Final streamed blob"),
          htmlBundleRef:
            "hosted-html:v1:artifact_final:revision_final:hash_final",
        }),
      );
      expect(onError).not.toHaveBeenCalled();
    });

    it("returns the final streamed blob when local best-effort rendering fails", async () => {
      mockFetch.mockResolvedValueOnce(
        createSseResponse([
          {
            type: "shell",
            html: '<!doctype html><html><body><main data-mtg-stream-slots><section data-mtg-stream-slot="section-1">Loading</section></main></body></html>',
          },
          {
            type: "done",
            html: "<!doctype html><html><body><strong>Final after render failure</strong></body></html>",
            id: "gen_render_failed",
          },
        ]),
      );

      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      vi.spyOn(target, "replaceChildren").mockImplementation(() => {
        throw new Error("local render failed");
      });
      const onDone = vi.fn();
      const onError = vi.fn();
      const tools = createMontageTools({ apiKey: "sk_test" });

      const result = await tools.stream(
        { prompt: "render failure", dataInfo: "{}" },
        { target, onDone, onError },
      );

      expect(result.html).toContain("Final after render failure");
      expect(result.diagnostics).toEqual([
        expect.objectContaining({
          code: "stream-render-failed",
          severity: "warning",
          message: expect.stringContaining("local render failed"),
        }),
        expect.objectContaining({
          code: "stream-render-failed",
          severity: "warning",
          phase: "sdk-stream-finalize",
          message: expect.stringContaining("local render failed"),
        }),
      ]);
      expect(onDone).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "gen_render_failed",
          html: expect.stringContaining("Final after render failure"),
        }),
      );
      expect(onError).not.toHaveBeenCalled();
    });

    it("can stream shell and slot fragments into a persistent shadow root with styles", async () => {
      mockFetch.mockResolvedValueOnce(
        createSseResponse([
          {
            type: "shell",
            html: '<!doctype html><html><head><style>body{font-family:Inter}.pipeline{color:rgb(16, 185, 129)}</style></head><body><main class="pipeline" data-mtg-stream-slots><section data-mtg-stream-slot="pipeline">Loading pipeline</section></main></body></html>',
          },
          {
            type: "slot",
            slot: "pipeline",
            html: '<article class="deal-card">Acme deal moved</article>',
            styles: "body{background:#fff}.deal-card{border-radius:8px}",
          },
          {
            type: "done",
            html: '<!doctype html><html><head><style>body{font-family:Inter}.final{color:rgb(37, 99, 235)}</style></head><body><strong class="final">Final pipeline</strong></body></html>',
            id: "gen_shadow",
            creditsUsed: 1,
          },
        ]),
      );

      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const observed: string[] = [];
      const tools = createMontageTools({ apiKey: "sk_test" });

      const result = await tools.stream(
        { prompt: "pipeline", dataInfo: "{}" },
        {
          target,
          mountMode: "shadow",
          onEvent: (event) => {
            if (event.type === "shell" || event.type === "slot") {
              const selector =
                event.type === "shell"
                  ? '[data-mtg-stream-slot="pipeline"]'
                  : ".deal-card";
              observed.push(
                target.shadowRoot
                  ?.querySelector(selector)
                  ?.textContent?.trim() ?? "",
              );
            }
          },
        },
      );

      expect(observed).toEqual(["Loading pipeline", "Acme deal moved"]);
      expect(target.innerHTML).toBe("");
      expect(target.shadowRoot?.textContent).toContain("Final pipeline");
      expect(target.shadowRoot?.querySelector(".final")).toBeTruthy();
      expect(
        Array.from(target.shadowRoot?.querySelectorAll("style") ?? []).some(
          (style) => style.textContent?.includes(":host"),
        ),
      ).toBe(true);
      expect(result.id).toBe("gen_shadow");
      result.cleanup();
      expect(target.shadowRoot?.textContent).toBe("");
    });

    it("exposes a reusable shadow stream surface for host apps", async () => {
      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const surface = createMontageStreamSurface(target, {
        mountMode: "shadow",
      });

      await surface.applyEvent({
        type: "shell",
        html: '<!doctype html><html><head><style>body{font-family:Inter}.status{color:rgb(15,23,42)}</style></head><body><main data-mtg-stream-slots><section data-mtg-stream-slot="status">Loading</section></main></body></html>',
      });
      await surface.applyEvent({
        type: "slot",
        slot: "status",
        html: '<article class="status">Live slot patched</article>',
      });

      expect(target.innerHTML).toBe("");
      expect(target.shadowRoot?.textContent).toContain("Live slot patched");
      expect(target.shadowRoot?.querySelector(".status")).toBeTruthy();
      expect(
        Array.from(target.shadowRoot?.querySelectorAll("style") ?? []).some(
          (style) => style.textContent?.includes(":host"),
        ),
      ).toBe(true);
      surface.cleanup();
      expect(target.shadowRoot?.textContent).toBe("");
    });

    it("normalizes chat-style stream section events and ignores malformed slots", async () => {
      expect(
        normalizeMontageStreamEvent({
          type: "section",
          id: "pipeline",
          text: "<article>Pipeline section</article>",
        }),
      ).toMatchObject({
        type: "slot",
        slot: "pipeline",
        html: "<article>Pipeline section</article>",
      });
      expect(
        normalizeMontageStreamEvent({
          type: "slot",
          text: "not html and no slot",
        }),
      ).toBeNull();

      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const surface = createMontageStreamSurface(target, {
        mountMode: "shadow",
      });

      await surface.applyEvent({
        type: "shell",
        html: '<main data-mtg-stream-slots><section data-mtg-stream-slot="pipeline">Loading</section></main>',
      });
      await surface.applyEvent({
        type: "slot",
        html: "<article>Should not mount</article>",
      } as never);
      await surface.applyEvent({
        type: "section",
        id: "pipeline",
        text: "<article>Mounted through normalized section</article>",
      } as never);

      expect(
        target.shadowRoot?.querySelector('[data-mtg-stream-slot="undefined"]'),
      ).toBeNull();
      expect(target.shadowRoot?.textContent).toContain(
        "Mounted through normalized section",
      );
    });

    it("runs stream document scripts after mounting a shadow stream shell", async () => {
      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const surface = createMontageStreamSurface(target, {
        mountMode: "shadow",
      });

      await surface.applyEvent({
        type: "shell",
        html: [
          "<!doctype html><html><head>",
          "<style>body{font-family:Inter}.ready{color:rgb(15,23,42)}</style>",
          "<script>host.setAttribute('data-head-script','ran')</script>",
          "</head><body>",
          '<main data-mtg-stream-slots><section class="ready" data-mtg-stream-slot="pipeline">Loading</section></main>',
          "<script>shadowRoot.querySelector('.ready').setAttribute('data-body-script','ran')</script>",
          "</body></html>",
        ].join(""),
      });

      expect(target.getAttribute("data-head-script")).toBe("ran");
      expect(
        target.shadowRoot
          ?.querySelector(".ready")
          ?.getAttribute("data-body-script"),
      ).toBe("ran");
    });

    it("installs the adapter bridge before reusable shadow surface scripts run", async () => {
      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const calls: unknown[] = [];
      const previousMontageAot = (
        globalThis as typeof globalThis & { MontageAOT?: unknown }
      ).MontageAOT;
      const adapter = createMontageAdapter({
        agent: { id: "agent", name: "Agent" },
        capabilities: [
          {
            name: "startup_data_query",
            effect: "query",
            availability: "adapter",
            description: "Load current startup data from the host app.",
          },
        ],
        invokeCapability: (request) => {
          calls.push(request);
          return [{ company: "Meridian Health" }];
        },
      });
      const surface = createMontageStreamSurface(target, {
        mountMode: "shadow",
        adapter,
        context: { source: "stream-surface-test" },
      });

      await surface.applyEvent({
        type: "shell",
        html: [
          "<main data-mtg-stream-slots></main>",
          '<script>globalThis.__mtgStreamBridgeResult = MontageAOT.invoke({name:"startup_data_query",effect:"query",args:{category:"pipeline"}})</script>',
        ].join(""),
      });

      await (
        globalThis as typeof globalThis & {
          __mtgStreamBridgeResult?: Promise<unknown>;
        }
      ).__mtgStreamBridgeResult;

      expect(calls).toEqual([
        expect.objectContaining({
          name: "startup_data_query",
          effect: "query",
          args: { category: "pipeline" },
          context: { source: "stream-surface-test" },
        }),
      ]);

      surface.cleanup();
      expect(
        (globalThis as typeof globalThis & { MontageAOT?: unknown }).MontageAOT,
      ).toBe(previousMontageAot);
      delete (
        globalThis as typeof globalThis & {
          __mtgStreamBridgeResult?: Promise<unknown>;
        }
      ).__mtgStreamBridgeResult;
    });

    it("mounts final stream parts with styles and scripts in shadow surfaces", async () => {
      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const calls: unknown[] = [];
      const adapter = createMontageAdapter({
        agent: { id: "agent", name: "Agent" },
        capabilities: [
          {
            name: "startup_data_query",
            effect: "query",
            availability: "adapter",
            description: "Load current startup data from the host app.",
          },
        ],
        invokeCapability: (request) => {
          calls.push(request);
          return [{ company: "Meridian Health" }];
        },
      });
      const surface = createMontageStreamSurface(target, {
        mountMode: "shadow",
        adapter,
        context: { source: "final-parts-test" },
      });

      await surface.applyEvent({
        type: "done",
        html: "<!doctype html><html><head><style>.from-html{display:grid}</style></head><body><main>Fallback without runtime</main></body></html>",
        parts: {
          fragment:
            '<main class="generated"><output data-testid="company">Loading</output></main>',
          styles: ".generated{color:rgb(37,99,235)}",
          scripts: [
            [
              "globalThis.__mtgFinalPartsResult = MontageAOT.invoke({",
              'name:"startup_data_query",',
              'effect:"query",',
              'args:{category:"pipeline"}',
              "}).then((records) => {",
              "shadowRoot.querySelector('[data-testid=\"company\"]').textContent = records[0].company;",
              "});",
            ].join(""),
          ],
        },
      });

      await (
        globalThis as typeof globalThis & {
          __mtgFinalPartsResult?: Promise<unknown>;
        }
      ).__mtgFinalPartsResult;

      expect(target.shadowRoot?.textContent).toContain("Meridian Health");
      expect(target.shadowRoot?.textContent).not.toContain(
        "Fallback without runtime",
      );
      expect(
        Array.from(target.shadowRoot?.querySelectorAll("style") ?? []).some(
          (style) => style.textContent?.includes(".generated"),
        ),
      ).toBe(true);
      expect(
        Array.from(target.shadowRoot?.querySelectorAll("style") ?? []).some(
          (style) => style.textContent?.includes(".from-html"),
        ),
      ).toBe(true);
      expect(calls).toEqual([
        expect.objectContaining({
          name: "startup_data_query",
          effect: "query",
          args: { category: "pipeline" },
          context: { source: "final-parts-test" },
        }),
      ]);

      surface.cleanup();
      delete (
        globalThis as typeof globalThis & {
          __mtgFinalPartsResult?: Promise<unknown>;
        }
      ).__mtgFinalPartsResult;
    });

    it("routes declared stream capability aliases through the adapter bridge", async () => {
      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const calls: unknown[] = [];
      const adapter = createMontageAdapter({
        agent: { id: "agent", name: "Agent" },
        capabilities: [
          {
            name: "startup_data_query",
            effect: "query",
            availability: "adapter",
            description: "Load current startup data from the host app.",
          },
        ],
        invokeCapability: (request) => {
          calls.push(request);
          return [{ company: "Meridian Health" }];
        },
      });
      const surface = createMontageStreamSurface(target, {
        mountMode: "shadow",
        adapter,
        context: { source: "stream-surface-test" },
        capabilityAliases: [
          {
            name: "startup_data_query",
            effect: "query",
            labels: ["Refresh Data"],
            args: { category: "pipeline" },
          },
        ],
      });

      await surface.applyEvent({
        type: "done",
        html: "<main><button>Refresh Data</button></main>",
      });

      target.shadowRoot?.querySelector("button")?.dispatchEvent(
        new dom.window.MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          composed: true,
        }),
      );
      await Promise.resolve();

      expect(calls).toEqual([
        expect.objectContaining({
          name: "startup_data_query",
          effect: "query",
          args: { category: "pipeline" },
          context: { source: "stream-surface-test" },
        }),
      ]);
      surface.cleanup();
    });

    it("reclaims the adapter bridge after a final artifact defines MontageAOT", async () => {
      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const calls: unknown[] = [];
      const adapter = createMontageAdapter({
        agent: { id: "agent", name: "Agent" },
        capabilities: [
          {
            name: "startup_data_query",
            effect: "query",
            availability: "adapter",
            description: "Load current startup data from the host app.",
          },
        ],
        invokeCapability: (request) => {
          calls.push(request);
          return [{ company: "Meridian Health" }];
        },
      });
      const surface = createMontageStreamSurface(target, {
        mountMode: "shadow",
        adapter,
        context: { source: "stream-reclaim-test" },
        capabilityAliases: [
          {
            name: "startup_data_query",
            effect: "query",
            labels: ["Refresh Data"],
            args: { category: "pipeline" },
          },
        ],
      });

      await surface.applyEvent({
        type: "done",
        html: [
          "<main><button>Refresh Data</button></main>",
          "<script>globalThis.MontageAOT = { invoke(request) { globalThis.__artifactRuntimeCall = request; return Promise.resolve('artifact-runtime'); } };</script>",
        ].join(""),
      });

      target.shadowRoot?.querySelector("button")?.dispatchEvent(
        new dom.window.MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          composed: true,
        }),
      );
      await Promise.resolve();

      expect(calls).toEqual([
        expect.objectContaining({
          name: "startup_data_query",
          effect: "query",
          args: { category: "pipeline" },
          context: { source: "stream-reclaim-test" },
        }),
      ]);
      expect(
        (globalThis as typeof globalThis & { __artifactRuntimeCall?: unknown })
          .__artifactRuntimeCall,
      ).toBeUndefined();
      surface.cleanup();
      delete (
        globalThis as typeof globalThis & { __artifactRuntimeCall?: unknown }
      ).__artifactRuntimeCall;
    });

    it("mirrors the adapter bridge into same-origin stream frames", async () => {
      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const calls: unknown[] = [];
      const events: unknown[] = [];
      const adapter = createMontageAdapter({
        agent: { id: "agent", name: "Agent" },
        capabilities: [
          {
            name: "startup_data_query",
            effect: "query",
            availability: "adapter",
            description: "Load current startup data from the host app.",
          },
        ],
        invokeCapability: (request) => {
          calls.push(request);
          return [{ company: "Meridian Health", value: "$1.8M" }];
        },
      });
      const surface = createMontageStreamSurface(target, {
        adapter,
        context: { source: "stream-frame-test" },
        onCapabilityEvent: (event) => events.push(event),
      });

      await surface.applyEvent({
        type: "done",
        html: '<main><iframe title="generated controls"></iframe></main>',
      });

      const frame = target.querySelector("iframe") as HTMLIFrameElement;
      const frameWindow = frame.contentWindow as Window & {
        MontageAOT?: {
          invoke?: (request: unknown) => Promise<unknown> | unknown;
        };
      };
      const result = await frameWindow.MontageAOT?.invoke?.({
        name: "startup_data_query",
        effect: "query",
        args: { category: "pipeline" },
      });

      expect(result).toEqual([{ company: "Meridian Health", value: "$1.8M" }]);
      expect(calls).toEqual([
        expect.objectContaining({
          name: "startup_data_query",
          effect: "query",
          args: { category: "pipeline" },
          context: { source: "stream-frame-test" },
        }),
      ]);
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            phase: "success",
            request: expect.objectContaining({
              name: "startup_data_query",
              args: { category: "pipeline" },
            }),
            result: [{ company: "Meridian Health", value: "$1.8M" }],
          }),
        ]),
      );
      surface.cleanup();
    });

    it("fills missing frame capability args from visible frame fields", async () => {
      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const calls: unknown[] = [];
      const adapter = createMontageAdapter({
        agent: { id: "agent", name: "Agent" },
        capabilities: [
          {
            name: "file_add",
            effect: "query",
            availability: "adapter",
            description: "Attach a note.",
          },
        ],
        invokeCapability: (request) => {
          calls.push(request);
          return { ok: true };
        },
      });
      const surface = createMontageStreamSurface(target, {
        adapter,
        context: { source: "stream-frame-form-test" },
      });

      await surface.applyEvent({
        type: "done",
        html: '<main><iframe title="generated controls"></iframe></main>',
      });

      const frame = target.querySelector("iframe") as HTMLIFrameElement;
      frame.contentDocument!.body.innerHTML =
        '<label>Note<textarea name="note">Typed frame note</textarea></label>';
      const frameWindow = frame.contentWindow as Window & {
        MontageAOT?: {
          invoke?: (request: unknown) => Promise<unknown> | unknown;
        };
      };
      await frameWindow.MontageAOT?.invoke?.({
        name: "file_add",
        effect: "query",
        args: { entityType: "pipeline", entityId: "deal-001", note: "" },
      });

      expect(calls).toEqual([
        expect.objectContaining({
          name: "file_add",
          effect: "query",
          args: {
            entityType: "pipeline",
            entityId: "deal-001",
            note: "Typed frame note",
          },
          context: { source: "stream-frame-form-test" },
        }),
      ]);
      surface.cleanup();
    });

    it("keeps a non-empty frame capability arg when a later matching field is empty", async () => {
      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const calls: unknown[] = [];
      const adapter = createMontageAdapter({
        agent: { id: "agent", name: "Agent" },
        capabilities: [
          {
            name: "file_add",
            effect: "query",
            availability: "adapter",
            description: "Attach a note.",
          },
        ],
        invokeCapability: (request) => {
          calls.push(request);
          return { ok: true };
        },
      });
      const surface = createMontageStreamSurface(target, {
        adapter,
        context: { source: "stream-frame-form-test" },
      });

      await surface.applyEvent({
        type: "done",
        html: '<main><iframe title="generated controls"></iframe></main>',
      });

      const frame = target.querySelector("iframe") as HTMLIFrameElement;
      frame.contentDocument!.body.innerHTML = `
        <label>Quick note<input name="note" value="Typed frame note" /></label>
        <label>Note<textarea name="note"></textarea></label>
      `;
      const frameWindow = frame.contentWindow as Window & {
        MontageAOT?: {
          invoke?: (request: unknown) => Promise<unknown> | unknown;
        };
      };
      await frameWindow.MontageAOT?.invoke?.({
        name: "file_add",
        effect: "query",
        args: { entityType: "pipeline", entityId: "deal-001", note: "" },
      });

      expect(calls).toEqual([
        expect.objectContaining({
          name: "file_add",
          args: expect.objectContaining({
            note: "Typed frame note",
          }),
        }),
      ]);
      surface.cleanup();
    });

    it("refreshes capability aliases for controls streamed inside frames", async () => {
      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const calls: unknown[] = [];
      const adapter = createMontageAdapter({
        agent: { id: "agent", name: "Agent" },
        capabilities: [
          {
            name: "startup_data_query",
            effect: "query",
            availability: "adapter",
            description: "Load current startup data from the host app.",
          },
        ],
        invokeCapability: (request) => {
          calls.push(request);
          return [{ company: "Atlas Capital" }];
        },
      });
      const surface = createMontageStreamSurface(target, {
        adapter,
        context: { source: "stream-frame-alias-test" },
        capabilityAliases: [
          {
            name: "startup_data_query",
            effect: "query",
            labels: ["Refresh Data"],
            args: { category: "pipeline" },
          },
        ],
      });

      await surface.applyEvent({
        type: "shell",
        html: '<main data-mtg-stream-slots><section data-mtg-stream-slot="controls"></section></main>',
      });
      await surface.applyEvent({
        type: "slot",
        slot: "controls",
        html: "<iframe></iframe>",
      });

      const frame = target.querySelector("iframe") as HTMLIFrameElement;
      frame.contentDocument!.body.innerHTML = "<button>Refresh Data</button>";
      frame.contentDocument!.querySelector("button")!.dispatchEvent(
        new dom.window.MouseEvent("click", {
          bubbles: true,
          cancelable: true,
        }),
      );
      await Promise.resolve();

      expect(calls).toEqual([
        expect.objectContaining({
          name: "startup_data_query",
          effect: "query",
          args: { category: "pipeline" },
          context: { source: "stream-frame-alias-test" },
        }),
      ]);
      surface.cleanup();
    });

    it("replays mounted slots when a refreshed shell arrives", async () => {
      mockFetch.mockResolvedValueOnce(
        createSseResponse([
          {
            type: "shell",
            html: '<!doctype html><html><body><main data-mtg-stream-slots><section data-mtg-stream-slot="section-1">Loading</section></main></body></html>',
          },
          {
            type: "slot",
            slot: "section-1",
            html: "<article>Progressive slot</article>",
          },
          {
            type: "shell",
            html: '<!doctype html><html><body><main data-mtg-stream-slots><section data-mtg-stream-slot="section-1">Fresh loading</section></main></body></html>',
          },
          {
            type: "done",
            html: "<!doctype html><html><body><strong>Final artifact</strong></body></html>",
            id: "gen_stream",
          },
        ]),
      );

      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const observed: string[] = [];
      const tools = createMontageTools({ apiKey: "sk_test" });

      await tools.stream(
        { prompt: "compare", dataInfo: "{}" },
        {
          target,
          onEvent: (event) => {
            if (event.type === "slot") {
              observed.push(`slot:${target.textContent?.trim()}`);
            }
            if (event.type === "shell") {
              observed.push(`shell:${target.textContent?.trim()}`);
            }
          },
        },
      );

      expect(observed).toEqual([
        "shell:Loading",
        "slot:Progressive slot",
        "shell:Progressive slot",
      ]);
      expect(target.textContent).toContain("Final artifact");
    });

    it("resolves hostedUrl from the final stream event", async () => {
      mockFetch.mockResolvedValueOnce(
        createSseResponse([
          {
            type: "done",
            html: "<!doctype html><html><body>Final</body></html>",
            id: "gen_stream",
            artifactId: "a1",
            version: "v1",
            hostedUrl: "https://api.usemontage.ai/a/a1",
          },
        ]),
      );

      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const tools = createMontageTools({ apiKey: "sk_test" });

      const result = await tools.stream(
        { prompt: "hosted dashboard", dataInfo: "{}", hosted: true },
        { target },
      );

      expect(result).toMatchObject({
        artifactId: "a1",
        version: "v1",
        hostedUrl: "https://api.usemontage.ai/a/a1",
      });
    });

    it("ignores metadata-only artifact events until the final done event", async () => {
      mockFetch.mockResolvedValueOnce(
        createSseResponse([
          {
            type: "shell",
            html: '<!doctype html><html><body><main data-mtg-stream-slots><section data-mtg-stream-slot="section-1">Loading</section></main></body></html>',
          },
          {
            type: "slot",
            slot: "section-1",
            html: "<article>Progressive artifact</article>",
          },
          {
            type: "artifact",
            artifactId: "a1",
            version: "v1",
            resolution: { kind: "fresh", path: "direct" },
          },
          {
            type: "done",
            html: "<!doctype html><html><body><strong>Final artifact</strong></body></html>",
            id: "gen_stream",
            creditsUsed: 3,
          },
        ]),
      );

      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const onDone = vi.fn();
      const onError = vi.fn();
      const tools = createMontageTools({ apiKey: "sk_test" });

      const result = await tools.stream(
        { prompt: "metadata artifact", dataInfo: "{}" },
        { target, onDone, onError },
      );

      expect(target.textContent).toContain("Final artifact");
      expect(result).toMatchObject({
        id: "gen_stream",
        artifactId: "a1",
        version: "v1",
        creditsUsed: 3,
        resolution: { kind: "fresh", path: "direct" },
      });
      expect(onDone).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "gen_stream",
          artifactId: "a1",
          version: "v1",
        }),
      );
      expect(onError).not.toHaveBeenCalled();
    });

    it("works with iframe targets", async () => {
      mockFetch.mockResolvedValueOnce(
        createSseResponse([
          {
            type: "shell",
            html: '<!doctype html><html><body><main data-mtg-stream-slots><section data-mtg-stream-slot="section-1">Loading</section></main></body></html>',
          },
          {
            type: "slot",
            slot: "section-1",
            html: "<article>Iframe slot</article>",
          },
          {
            type: "done",
            html: "<!doctype html><html><body><strong>Iframe final</strong></body></html>",
            id: "gen_iframe",
            creditsUsed: 1,
          },
        ]),
      );

      const dom = new JSDOM("<iframe></iframe>", { url: "http://localhost" });
      const iframe = dom.window.document.querySelector(
        "iframe",
      ) as HTMLIFrameElement;
      const tools = createMontageTools({ apiKey: "sk_test" });

      const result = await tools.stream(
        { prompt: "iframe", dataInfo: "{}" },
        { target: iframe },
      );

      expect(iframe.contentDocument?.body.textContent).toContain(
        "Iframe final",
      );
      expect(result.id).toBe("gen_iframe");
    });

    it("waits for a visible slot paint before final replacement", async () => {
      mockFetch.mockResolvedValueOnce(
        createSseResponse([
          {
            type: "shell",
            html: '<!doctype html><html><body><main data-mtg-stream-slots><section data-mtg-stream-slot="section-1">Loading</section></main></body></html>',
          },
          {
            type: "slot",
            slot: "section-1",
            html: "<article>Painted slot</article>",
          },
          {
            type: "done",
            html: "<!doctype html><html><body><strong>Final after paint</strong></body></html>",
            id: "gen_painted",
            creditsUsed: 2,
          },
        ]),
      );

      const dom = new JSDOM("<iframe></iframe>", {
        url: "http://localhost",
        pretendToBeVisual: true,
      });
      const iframe = dom.window.document.querySelector(
        "iframe",
      ) as HTMLIFrameElement;
      const view = iframe.contentWindow;
      expect(view).toBeTruthy();

      const frameCallbacks: FrameRequestCallback[] = [];
      const timeoutCallbacks: Array<() => void> = [];
      if (view) {
        view.requestAnimationFrame = ((
          callback: FrameRequestCallback,
        ): number => {
          frameCallbacks.push(callback);
          return frameCallbacks.length;
        }) as typeof view.requestAnimationFrame;
        view.setTimeout = ((handler: TimerHandler): number => {
          timeoutCallbacks.push(() => {
            if (typeof handler === "function") handler();
          });
          return timeoutCallbacks.length;
        }) as typeof view.setTimeout;
      }

      const tools = createMontageTools({ apiKey: "sk_test" });
      const streamPromise = tools.stream(
        { prompt: "iframe", dataInfo: "{}" },
        { target: iframe },
      );

      await vi.waitFor(() => {
        expect(iframe.contentDocument?.body.textContent).toContain(
          "Painted slot",
        );
      });
      expect(iframe.contentDocument?.body.textContent).not.toContain(
        "Final after paint",
      );

      frameCallbacks.shift()?.(0);
      await Promise.resolve();
      frameCallbacks.shift()?.(16);
      await Promise.resolve();
      timeoutCallbacks.shift()?.();

      const result = await streamPromise;
      expect(iframe.contentDocument?.body.textContent).toContain(
        "Final after paint",
      );
      expect(result.id).toBe("gen_painted");
    });

    it("finalizes correctly when the stream only returns done", async () => {
      mockFetch.mockResolvedValueOnce(
        createSseResponse([
          {
            type: "done",
            html: "<!doctype html><html><body>Cached final</body></html>",
            id: "gen_cached",
            creditsUsed: 0,
          },
        ]),
      );

      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const onDone = vi.fn();
      const tools = createMontageTools({ apiKey: "sk_test" });

      const result = await tools.stream(
        { prompt: "cached", dataInfo: "{}", cache: "read" },
        { target, onDone },
      );

      expect(target.textContent).toContain("Cached final");
      expect(result.id).toBe("gen_cached");
      expect(onDone).toHaveBeenCalledWith(
        expect.objectContaining({ id: "gen_cached" }),
      );
      const [, opts] = mockFetch.mock.calls[0];
      expect(JSON.parse(opts.body).cache).toBe("read");
    });

    it.each(["done", "artifact"] as const)(
      "finalizes correctly when the %s event only includes artifact parts",
      async (type) => {
        const parts = {
          fragment: '<main class="parts-final"><h1>Parts final</h1></main>',
          styles: ".parts-final{color:rgb(37,99,235)}",
          scripts: ["document.body.setAttribute('data-final-parts','mounted')"],
        };
        mockFetch.mockResolvedValueOnce(
          createSseResponse([
            {
              type,
              parts,
              id: "gen_parts",
              creditsUsed: 2,
            },
          ]),
        );

        const dom = new JSDOM('<div id="target"></div>', {
          url: "http://localhost",
        });
        const target = dom.window.document.getElementById(
          "target",
        ) as HTMLElement;
        const onDone = vi.fn();
        const onError = vi.fn();
        const tools = createMontageTools({ apiKey: "sk_test" });

        const result = await tools.stream(
          { prompt: "parts-only final", dataInfo: "{}" },
          { target, onDone, onError },
        );

        expect(target.textContent).toContain("Parts final");
        expect(target.innerHTML).toContain(".parts-final");
        expect(result).toMatchObject({
          id: "gen_parts",
          creditsUsed: 2,
          html: expect.stringContaining("Parts final"),
          parts,
        });
        expect(onDone).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "gen_parts",
            html: expect.stringContaining("Parts final"),
            parts,
          }),
        );
        expect(onError).not.toHaveBeenCalled();
      },
    );

    it("rejects and cleans up safely on stream error events", async () => {
      mockFetch.mockResolvedValueOnce(
        createSseResponse([
          {
            type: "shell",
            html: '<!doctype html><html><body><main data-mtg-stream-slots><section data-mtg-stream-slot="section-1">Loading</section></main></body></html>',
          },
          { type: "error", text: "Generation failed" },
        ]),
      );

      const dom = new JSDOM('<div id="target"></div>', {
        url: "http://localhost",
      });
      const target = dom.window.document.getElementById(
        "target",
      ) as HTMLElement;
      const onError = vi.fn();
      const tools = createMontageTools({ apiKey: "sk_test" });

      await expect(
        tools.stream({ prompt: "error", dataInfo: "{}" }, { target, onError }),
      ).rejects.toMatchObject({ code: "stream_error" });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "stream_error",
          message: "Generation failed",
        }),
      );
      expect(target.innerHTML).toBe("");
    });
  });

  describe("executeStreaming", () => {
    it("throws an aborted error when the request signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();
      mockFetch.mockRejectedValueOnce(
        new DOMException("The operation was aborted.", "AbortError"),
      );

      const tools = createMontageTools({ apiKey: "sk_test" });

      await expect(
        tools.executeStreaming({ prompt: "stream", dataInfo: "{}" }, () => {}, {
          signal: controller.signal,
        }),
      ).rejects.toMatchObject({
        code: "aborted",
        status: 0,
      });
    });
  });
});
