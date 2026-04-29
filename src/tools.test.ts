import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMontageTools, MontageApiError } from "./tools";

const originalFetch = globalThis.fetch;

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
        outputQuality: "high",
        designSystem: { theme: "dark", colors: { primary: "#ff0000" } },
        backendType: "fluxUI",
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

    it("input_schema.properties has prompt, dataInfo, outputQuality, and designSystem", () => {
      const tools = createMontageTools({ apiKey: "sk_test" });
      const [def] = tools.anthropic();
      const props = def.input_schema.properties as Record<string, unknown>;
      expect(props).toHaveProperty("prompt");
      expect(props).toHaveProperty("dataInfo");
      expect(props).toHaveProperty("outputQuality");
      expect(props).toHaveProperty("designSystem");
    });

    it("description mentions visual and markdown", () => {
      const tools = createMontageTools({ apiKey: "sk_test" });
      const [def] = tools.anthropic();
      expect(def.description.toLowerCase()).toContain("visual");
      expect(def.description.toLowerCase()).toContain("markdown");
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

    it("sends prompt, dataInfo, and normalized default outputQuality in the body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gen_1", html: "<p/>", creditsUsed: 1 }),
      });

      const tools = createMontageTools({ apiKey: "sk_test" });
      await tools.execute({
        prompt: "my prompt",
        dataInfo: '{"key":"value"}',
        outputQuality: "high",
      });

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.prompt).toBe("my prompt");
      expect(body.dataInfo).toBe('{"key":"value"}');
      expect(body.outputQuality).toBe("default");
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

    it("defaults outputQuality to 'default' when not specified", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gen_1", html: "<p/>", creditsUsed: 1 }),
      });

      const tools = createMontageTools({ apiKey: "sk_test" });
      await tools.execute({ prompt: "prompt", dataInfo: "{}" });

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.outputQuality).toBe("default");
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

    it("temporarily normalizes config.defaults.outputQuality to default", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gen_1", html: "<p/>", creditsUsed: 1 }),
      });

      const tools = createMontageTools({
        apiKey: "sk_test",
        defaults: { outputQuality: "xhigh" },
      });
      await tools.execute({ prompt: "prompt", dataInfo: "{}" });

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.outputQuality).toBe("default");
    });

    it("per-call outputQuality overrides the default", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gen_1", html: "<p/>", creditsUsed: 1 }),
      });

      const tools = createMontageTools({
        apiKey: "sk_test",
        defaults: { outputQuality: "xhigh" },
      });
      await tools.execute({ prompt: "prompt", dataInfo: "{}", outputQuality: "default" });

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.outputQuality).toBe("default");
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

    it("includes config.defaults.backendType in the request body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gen_1", html: "<p/>", creditsUsed: 1 }),
      });

      const tools = createMontageTools({
        apiKey: "sk_test",
        defaults: { backendType: "fluxUI" },
      });
      await tools.execute({ prompt: "prompt", dataInfo: "{}" });

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.backendType).toBe("fluxUI");
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
});
