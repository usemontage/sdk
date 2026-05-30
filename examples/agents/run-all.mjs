import http from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { JSDOM } from "jsdom";
import { createMontageTools, integrations } from "../../dist/index.js";

const DEMO_HTML =
  '<!doctype html><html><body><main data-demo="montage-agent" data-surface="typescript-sdk"><h1>Agent demo artifact</h1><button data-action="refresh">Refresh</button></main></body></html>';
const SHELL_HTML =
  '<!doctype html><html><body data-mtg-streaming="true"><main data-demo="montage-agent-shell"><div data-mtg-stream-slots></div></main></body></html>';
const SLOT_HTML =
  '<section data-demo="montage-agent-slot"><h2>Pipeline insight</h2><p>Streaming content mounted.</p></section>';

function createMockApi() {
  const requests = [];
  const adapters = new Map();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const method = req.method ?? "GET";

    if (method === "POST" && url.pathname === "/v1/generate") {
      const body = await readJson(req);
      requests.push({ method, path: url.pathname, body });

      if (body.streaming) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        await writeSse(res, { type: "status", text: "Planning dashboard" });
        await writeSse(res, { type: "shell", html: SHELL_HTML });
        await writeSse(res, { type: "slot", slot: "main", html: SLOT_HTML });
        await writeSse(res, {
          type: "done",
          id: "gen_demo_1",
          artifactId: "art_demo_1",
          version: "v1",
          html: DEMO_HTML,
          creditsUsed: 0,
        });
        res.end();
        return;
      }

      sendJson(res, {
        id: "gen_demo_1",
        artifactId: "art_demo_1",
        version: "v1",
        html: DEMO_HTML,
        creditsUsed: 0,
      });
      return;
    }

    if (method === "GET" && url.pathname === "/v1/adapters") {
      sendJson(res, { data: Array.from(adapters.values()) });
      return;
    }

    if (url.pathname.startsWith("/v1/adapters/")) {
      const provider = decodeURIComponent(url.pathname.split("/").pop() ?? "");
      if (method === "PUT") {
        const body = await readJson(req);
        adapters.set(provider, {
          provider,
          configuredAt: "2026-05-23T00:00:00.000Z",
          keys: Object.keys(body),
        });
        sendJson(res, { success: true });
        return;
      }
      if (method === "DELETE") {
        adapters.delete(provider);
        res.writeHead(204).end();
        return;
      }
    }

    if (method === "GET" && url.pathname === "/v1/components") {
      sendJson(res, { data: [{ id: "table", name: "Table", type: "table" }] });
      return;
    }

    if (method === "GET" && url.pathname === "/v1/artifacts") {
      sendJson(res, { artifacts: [{ id: "art_demo_1", html: DEMO_HTML }] });
      return;
    }

    if (method === "GET" && url.pathname === "/v1/artifacts/art_demo_1") {
      sendJson(res, { id: "art_demo_1", html: DEMO_HTML, version: "v1" });
      return;
    }

    if (method === "GET" && url.pathname === "/v1/artifacts/art_demo_1/versions") {
      sendJson(res, { versions: [{ version: "v1", html: DEMO_HTML }] });
      return;
    }

    sendJson(res, { error: { code: "not_found", message: `${method} ${url.pathname}` } }, 404);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Mock API did not expose a TCP port."));
        return;
      }
      resolve({
        apiUrl: `http://127.0.0.1:${address.port}`,
        requests,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, body, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function writeSse(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
  await delay(12);
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function htmlLooksReal(html) {
  return html.includes('data-demo="montage-agent"') && html.includes("<button");
}

function fakeZod() {
  const chain = {
    describe() {
      return this;
    },
    optional() {
      return this;
    },
  };
  return {
    object: (shape) => ({ kind: "object", shape }),
    string: () => ({ ...chain, kind: "string" }),
    record: () => ({ ...chain, kind: "record" }),
    unknown: () => ({ ...chain, kind: "unknown" }),
    enum: (values) => ({ ...chain, kind: "enum", values }),
  };
}

async function runToolAgent(tool, input) {
  if (typeof tool.execute === "function") return tool.execute(input);
  if (typeof tool.func === "function") return JSON.parse(await tool.func(input));
  throw new Error(`Unsupported tool shape for ${tool.name ?? tool.id ?? "unknown tool"}`);
}

async function record(rows, surface, fn) {
  try {
    const result = await fn();
    rows.push({ package: "@montageai/sdk", surface, result: `PASS ${result}` });
  } catch (error) {
    rows.push({ package: "@montageai/sdk", surface, result: `FAIL ${error.message}` });
  }
}

function printMatrix(rows) {
  const widths = {
    package: Math.max("Package".length, ...rows.map((row) => row.package.length)),
    surface: Math.max("Surface".length, ...rows.map((row) => row.surface.length)),
  };
  console.log(`${"Package".padEnd(widths.package)}  ${"Surface".padEnd(widths.surface)}  Result`);
  console.log(`${"-".repeat(widths.package)}  ${"-".repeat(widths.surface)}  ------`);
  for (const row of rows) {
    console.log(`${row.package.padEnd(widths.package)}  ${row.surface.padEnd(widths.surface)}  ${row.result}`);
  }
}

const server = await createMockApi();
const rows = [];

try {
  const toolkit = createMontageTools({
    apiKey: "mtg_demo_key",
    apiUrl: server.apiUrl,
  });
  const input = {
    prompt: "Interactive startup pipeline agent workspace",
    dataInfo: '{"deals":[]}',
    interactive: true,
    requestId: "typescript-agent-proof",
  };

  await record(rows, "createMontageTools.execute", async () => {
    const result = await toolkit.execute(input);
    expect(result.id === "gen_demo_1", "generate result id mismatch");
    expect(htmlLooksReal(result.html), "generated HTML did not include the agent demo artifact");
    return result.id;
  });

  await record(rows, "createMontageTools.executeStreaming", async () => {
    const events = [];
    await toolkit.executeStreaming(input, (event) => events.push(event.type));
    expect(events.join(",") === "status,shell,slot,done", `unexpected event order: ${events.join(",")}`);
    return "status,shell,slot,done";
  });

  await record(rows, "createMontageTools.stream", async () => {
    const dom = new JSDOM('<!doctype html><div id="target"></div>', { pretendToBeVisual: true });
    const target = dom.window.document.getElementById("target");
    const result = await toolkit.stream(input, { target });
    expect(htmlLooksReal(result.html), "stream final HTML missing demo artifact");
    expect(target.innerHTML.includes("Agent demo artifact"), "stream did not mount final HTML");
    return result.id ?? "done";
  });

  await record(rows, "anthropic schema", async () => {
    const [tool] = toolkit.anthropic();
    expect(tool.name === "montage_generate", "Anthropic tool name mismatch");
    expect(Array.isArray(tool.input_schema.required), "Anthropic schema missing required list");
    return "montage_generate";
  });

  await record(rows, "openai schema", async () => {
    const [tool] = toolkit.openai();
    expect(tool.function.name === "montage_generate", "OpenAI tool name mismatch");
    expect(tool.type === "function", "OpenAI tool type mismatch");
    return "montage_generate";
  });

  const z = fakeZod();
  const integrationFactories = [
    ["raw", () => integrations.raw(toolkit)],
    ["mastra", () => integrations.mastra(toolkit, z)],
    ["langchain", () => integrations.langchain(toolkit, z)],
    ["vercelAi", () => integrations.vercelAi(toolkit, z)],
    ["agno", () => integrations.agno(toolkit)],
    ["cloudflareAgent", () => integrations.cloudflareAgent(toolkit)],
    ["strands", () => integrations.strands(toolkit)],
  ];

  for (const [surface, factory] of integrationFactories) {
    await record(rows, surface, async () => {
      const result = await runToolAgent(factory(), input);
      expect(result.id === "gen_demo_1", `${surface} did not call Montage`);
      expect(htmlLooksReal(result.html), `${surface} did not return a real artifact`);
      return result.id;
    });
  }

  printMatrix(rows);

  const failed = rows.filter((row) => row.result.startsWith("FAIL"));
  if (failed.length > 0) {
    process.exitCode = 1;
  }
} finally {
  await server.close();
}
