import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JSDOM } from "jsdom";
import { createMontageTools, MontageApiError } from "./tools";
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
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
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
      defaults: {
        designSystem: { theme: "dark", colors: { primary: "#ff0000" } },
        renderSurface: { width: 1920, height: 1080 },
      },
    });
    expect(tools).toBeDefined();
    expect(tools.openai()).toHaveLength(1);
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

    it("input_schema has type object and required prompt and dataInfo", () => {
      const tools = createMontageTools({ apiKey: "sk_test" });
      const [def] = tools.anthropic();
      expect(def.input_schema.type).toBe("object");
      expect(def.input_schema.required).toEqual(["prompt", "dataInfo"]);
    });

    it("input_schema.properties has prompt, dataInfo, and designSystem", () => {
      const tools = createMontageTools({ apiKey: "sk_test" });
      const [def] = tools.anthropic();
      const props = def.input_schema.properties as Record<string, unknown>;
      expect(props).toHaveProperty("prompt");
      expect(props).toHaveProperty("dataInfo");
      expect(props).toHaveProperty("designSystem");
    });

    it("exposes agent contract controls in the tool schema", () => {
      const tools = createMontageTools({ apiKey: "sk_test" });
      const [def] = tools.anthropic();
      const props = def.input_schema.properties as Record<string, unknown>;

      expect(props).toEqual(expect.objectContaining({
        hosted: expect.objectContaining({ type: "boolean" }),
        strictData: expect.objectContaining({ type: "boolean" }),
        requiredFields: expect.objectContaining({ type: "array" }),
        requiredCapabilities: expect.objectContaining({ type: "array" }),
        data: expect.objectContaining({ description: expect.any(String) }),
      }));
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
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: [{ provider: "supabase", configuredAt: "2026-05-20T00:00:00Z", keys: ["SUPABASE_URL"] }],
          }),
        })
        .mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) });

      const tools = createMontageTools({ apiKey: "sk_test", apiUrl: "https://api.example.test" });

      await tools.adapters.configure("supabase", {
        SUPABASE_URL: "https://acme.supabase.co",
        SUPABASE_ANON_KEY: "anon",
      });
      const adapters = await tools.adapters.list();
      await tools.adapters.remove("supabase");

      expect(adapters).toEqual([
        { provider: "supabase", configuredAt: "2026-05-20T00:00:00Z", keys: ["SUPABASE_URL"] },
      ]);
      expect(mockFetch.mock.calls[0][0]).toBe("https://api.example.test/v1/adapters/supabase");
      expect(mockFetch.mock.calls[0][1].method).toBe("PUT");
      expect(mockFetch.mock.calls[1][0]).toBe("https://api.example.test/v1/adapters");
      expect(mockFetch.mock.calls[2][1].method).toBe("DELETE");
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
        json: async () => ({ id: "gen_abc", html: "<div>ok</div>", creditsUsed: 1 }),
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
        json: async () => ({ id: "gen_test123", html: "<section>test</section>", creditsUsed: 2 }),
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
      expect(body).toEqual(expect.objectContaining({
        hosted: true,
        strictData: true,
        data: { investors: [{ firm: "Northstar", partner: "Maya" }] },
        requiredFields: ["firm", "partner"],
        requiredCapabilities: ["fetchInvestors"],
      }));
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
      const result = await tools.execute({ prompt: "cached artifact", dataInfo: "{}" });

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
          artifact: { html: "<!DOCTYPE html><html><body><section>bundle</section></body></html>" },
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

      const tools = createMontageTools({ apiKey: "sk_test", apiUrl: "https://custom.example.com" });
      await tools.execute({ prompt: "prompt", dataInfo: "{}" });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://custom.example.com/v1/generate");
    });

    it("does not strip trailing slashes from apiUrl (appends path directly)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gen_1", html: "<p/>", creditsUsed: 1 }),
      });

      const tools = createMontageTools({ apiKey: "sk_test", apiUrl: "https://custom.example.com/" });
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
        defaults: { renderSurface: { width: 800, height: 600, devicePixelRatio: 2 } },
      });
      await tools.execute({ prompt: "prompt", dataInfo: "{}" });

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.renderSurface).toEqual({ width: 800, height: 600, devicePixelRatio: 2 });
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
        json: async () => ({ code: "GENERATION_REQUIRES_SECRET_KEY", message: "Requires sk key" }),
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

  describe("stream", () => {
    it("MontageStreamOptions accepts adapter, context, and onCapabilityError", () => {
      const dom = new JSDOM("<div id=\"target\"></div>", { url: "http://localhost" });
      const target = dom.window.document.getElementById("target") as HTMLElement;
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
      mockFetch.mockResolvedValueOnce(createSseResponse([
        { type: "done", html: "<!doctype html><html><body>Final</body></html>", id: "gen_stream" },
      ]));

      const dom = new JSDOM("<div id=\"target\"></div>", { url: "http://localhost" });
      const target = dom.window.document.getElementById("target") as HTMLElement;
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
      mockFetch.mockResolvedValueOnce(createSseResponse([
        { type: "done", html: "<!doctype html><html><body>Final</body></html>", id: "gen_stream" },
      ]));

      const dom = new JSDOM("<div id=\"target\"></div>", { url: "http://localhost" });
      const target = dom.window.document.getElementById("target") as HTMLElement;
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
      mockFetch.mockResolvedValueOnce(createSseResponse([
        { type: "status", text: "Generating..." },
        {
          type: "shell",
          html: '<!doctype html><html><body><main data-mtg-stream-slots><section data-mtg-stream-slot="section-1">Loading</section></main></body></html>',
        },
        { type: "slot", slot: "section-1", html: "<article>Progressive slot</article>" },
        { type: "done", html: "<!doctype html><html><body><strong>Final artifact</strong></body></html>", id: "gen_stream", creditsUsed: 3, cacheKey: "final:abc" },
      ]));

      const dom = new JSDOM("<div id=\"target\"></div>", { url: "http://localhost" });
      const target = dom.window.document.getElementById("target") as HTMLElement;
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

    it("resolves hostedUrl from the final stream event", async () => {
      mockFetch.mockResolvedValueOnce(createSseResponse([
        {
          type: "done",
          html: "<!doctype html><html><body>Final</body></html>",
          id: "gen_stream",
          artifactId: "a1",
          version: "v1",
          hostedUrl: "https://api.usemontage.ai/a/a1",
        },
      ]));

      const dom = new JSDOM("<div id=\"target\"></div>", { url: "http://localhost" });
      const target = dom.window.document.getElementById("target") as HTMLElement;
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

    it("works with iframe targets", async () => {
      mockFetch.mockResolvedValueOnce(createSseResponse([
        {
          type: "shell",
          html: '<!doctype html><html><body><main data-mtg-stream-slots><section data-mtg-stream-slot="section-1">Loading</section></main></body></html>',
        },
        { type: "slot", slot: "section-1", html: "<article>Iframe slot</article>" },
        { type: "done", html: "<!doctype html><html><body><strong>Iframe final</strong></body></html>", id: "gen_iframe", creditsUsed: 1 },
      ]));

      const dom = new JSDOM("<iframe></iframe>", { url: "http://localhost" });
      const iframe = dom.window.document.querySelector("iframe") as HTMLIFrameElement;
      const tools = createMontageTools({ apiKey: "sk_test" });

      const result = await tools.stream(
        { prompt: "iframe", dataInfo: "{}" },
        { target: iframe },
      );

      expect(iframe.contentDocument?.body.textContent).toContain("Iframe final");
      expect(result.id).toBe("gen_iframe");
    });

    it("waits for a visible slot paint before final replacement", async () => {
      mockFetch.mockResolvedValueOnce(createSseResponse([
        {
          type: "shell",
          html: '<!doctype html><html><body><main data-mtg-stream-slots><section data-mtg-stream-slot="section-1">Loading</section></main></body></html>',
        },
        { type: "slot", slot: "section-1", html: "<article>Painted slot</article>" },
        { type: "done", html: "<!doctype html><html><body><strong>Final after paint</strong></body></html>", id: "gen_painted", creditsUsed: 2 },
      ]));

      const dom = new JSDOM("<iframe></iframe>", {
        url: "http://localhost",
        pretendToBeVisual: true,
      });
      const iframe = dom.window.document.querySelector("iframe") as HTMLIFrameElement;
      const view = iframe.contentWindow;
      expect(view).toBeTruthy();

      const frameCallbacks: FrameRequestCallback[] = [];
      const timeoutCallbacks: Array<() => void> = [];
      if (view) {
        view.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
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
        expect(iframe.contentDocument?.body.textContent).toContain("Painted slot");
      });
      expect(iframe.contentDocument?.body.textContent).not.toContain("Final after paint");

      frameCallbacks.shift()?.(0);
      await Promise.resolve();
      frameCallbacks.shift()?.(16);
      await Promise.resolve();
      timeoutCallbacks.shift()?.();

      const result = await streamPromise;
      expect(iframe.contentDocument?.body.textContent).toContain("Final after paint");
      expect(result.id).toBe("gen_painted");
    });

    it("finalizes correctly when the stream only returns done", async () => {
      mockFetch.mockResolvedValueOnce(createSseResponse([
        { type: "done", html: "<!doctype html><html><body>Cached final</body></html>", id: "gen_cached", creditsUsed: 0 },
      ]));

      const dom = new JSDOM("<div id=\"target\"></div>", { url: "http://localhost" });
      const target = dom.window.document.getElementById("target") as HTMLElement;
      const onDone = vi.fn();
      const tools = createMontageTools({ apiKey: "sk_test" });

      const result = await tools.stream(
        { prompt: "cached", dataInfo: "{}", cache: "read" },
        { target, onDone },
      );

      expect(target.textContent).toContain("Cached final");
      expect(result.id).toBe("gen_cached");
      expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ id: "gen_cached" }));
      const [, opts] = mockFetch.mock.calls[0];
      expect(JSON.parse(opts.body).cache).toBe("read");
    });

    it("rejects and cleans up safely on stream error events", async () => {
      mockFetch.mockResolvedValueOnce(createSseResponse([
        {
          type: "shell",
          html: '<!doctype html><html><body><main data-mtg-stream-slots><section data-mtg-stream-slot="section-1">Loading</section></main></body></html>',
        },
        { type: "error", text: "Generation failed" },
      ]));

      const dom = new JSDOM("<div id=\"target\"></div>", { url: "http://localhost" });
      const target = dom.window.document.getElementById("target") as HTMLElement;
      const onError = vi.fn();
      const tools = createMontageTools({ apiKey: "sk_test" });

      await expect(
        tools.stream(
          { prompt: "error", dataInfo: "{}" },
          { target, onError },
        ),
      ).rejects.toMatchObject({ code: "stream_error" });

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        code: "stream_error",
        message: "Generation failed",
      }));
      expect(target.innerHTML).toBe("");
    });
  });

  describe("executeStreaming", () => {
    it("throws an aborted error when the request signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();
      mockFetch.mockRejectedValueOnce(new DOMException("The operation was aborted.", "AbortError"));

      const tools = createMontageTools({ apiKey: "sk_test" });

      await expect(
        tools.executeStreaming(
          { prompt: "stream", dataInfo: "{}" },
          () => {},
          { signal: controller.signal },
        ),
      ).rejects.toMatchObject({
        code: "aborted",
        status: 0,
      });
    });
  });
});
