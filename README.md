# `@montage/sdk`

The Montage SDK turns any LLM into a UI-rendering agent. Add `montage_generate`
to your tool registry, hand the resulting HTML to the SDK's `<HtmlBlock>` (or
mount the bundled HTML yourself), and your model can produce dashboards,
charts, reports, forms, and full mini-applications instead of plain text.

The SDK is API-driven — every render goes through the Montage rendering
service. The package contains:

- A typed `createMontageTools()` factory that calls `POST /v1/generate`
- Framework adapters for Mastra, LangChain, and the Vercel AI SDK
- A React `<HtmlBlock>` component that mounts self-contained bundled HTML and
  executes the artifact's inline scripts
- Agent-host primitives — `createMontageAdapter()` and
  `bindMontageCapabilityBridge()` — for routing explicit artifact capability
  calls to host functions

## Install

```bash
pnpm add @montage/sdk
# or
npm install @montage/sdk
```

`react` and `react-dom` are optional peer dependencies — only required if you
use the `@montage/sdk/react` entry point.

## Quick start

Get an API key from https://montage.dev, then:

> `createMontageTools()` sends your API key as a Bearer token and should run in
> trusted server-side code: API routes, workers, server actions, or agent
> runtimes. Browser apps should call your server and render the returned HTML
> with `<HtmlBlock>`.

```ts
import Anthropic from "@anthropic-ai/sdk";
import { createMontageTools } from "@montage/sdk";

const client = new Anthropic();
const montage = createMontageTools({ apiKey: process.env.MONTAGE_API_KEY! });

const response = await client.messages.create({
  model: "claude-opus-4-7",
  max_tokens: 4096,
  tools: montage.anthropic(),
  messages: [
    { role: "user", content: "Show me a Q4 revenue dashboard" },
  ],
});

for (const block of response.content) {
  if (block.type === "tool_use" && block.name === "montage_generate") {
    const result = await montage.execute(block.input as Parameters<typeof montage.execute>[0]);
    console.log(result.html); // ready-to-render HTML
  }
}
```

`montage.execute({ prompt, dataInfo, outputQuality?, designSystem? })` returns
`{ id, html, creditsUsed }`.

Use `prompt` as a product-level render brief, not an internal source format or
low-level layout blueprint. A good brief names the goal, audience, workflow,
entities, required interactions, starting state, constraints, and anti-goals.
For import/upload workflows, say the artifact needs a real file picker and
include expected file types and fields in `dataInfo`.

## Design systems

Pass a partial `designSystem` to brand the output. Pixel values are RGB hex; the
server fills in the rest from the default Montage system and inlines the
resulting CSS in the bundled artifact.

```ts
const result = await montage.execute({
  prompt: "Show me a brand-aligned project status page",
  dataInfo: '{"projects":[...]}',
  designSystem: {
    label: "Acme",
    theme: "dark",
    palette: "Modern",
    typography: "Inter",
    colors: {
      primary: "#FF6A00",
      background: "#0A0E1A",
    },
  },
});
```

You can also bake defaults into the toolkit:

```ts
const montage = createMontageTools({
  apiKey: process.env.MONTAGE_API_KEY!,
  defaults: {
    outputQuality: "default",
    designSystem: { theme: "dark", palette: "Notion" },
  },
});
```

## Framework integrations

The `integrations` namespace wraps the same `execute()` function in the shape
each framework expects. You provide your own `zod` instance — no version
conflict.

```ts
import { z } from "zod";
import { integrations, createMontageTools } from "@montage/sdk";

const toolkit = createMontageTools({ apiKey: process.env.MONTAGE_API_KEY! });

// Mastra: { id, description, inputSchema, execute }
const mastraTool = integrations.mastra(toolkit, z);

// LangChain: { name, description, schema, func }
const langchainTool = integrations.langchain(toolkit, z);

// Vercel AI SDK: { description, parameters, execute }
const aiTool = integrations.vercelAi(toolkit, z);

// Generic JSON-schema definition
const rawTool = integrations.raw(toolkit);
```

## Rendering generated HTML in React

```tsx
import { HtmlBlock } from "@montage/sdk/react";

function Output({ result }: { result: { html: string } }) {
  return <HtmlBlock html={result.html} />;
}
```

`<HtmlBlock>` sets the bundled HTML into the host element and executes its
inline scripts. Theme CSS, component CSS, event delegation, state updates, and
DOM updates are owned by the artifact itself.

```tsx
import { HtmlBlock } from "@montage/sdk/react";
import { createMontageAdapter } from "@montage/sdk";

const adapter = createMontageAdapter({
  agent: { id: "ops", name: "Ops Agent" },
  capabilities: [
    {
      name: "fetchEmails",
      effect: "query",
      description: "Fetch recent email summaries.",
      availability: "adapter",
    },
  ],
  async invokeCapability(request) {
    if (request.name === "fetchEmails") {
      return fetchEmails(request.args?.[0]);
    }
    throw new Error(`Unknown capability: ${request.name}`);
  },
});

<HtmlBlock
  html={result.html}
  adapter={adapter}
/>
```

## Capability adapter

Artifacts call host capabilities through the generated artifact bridge. The
SDK's only runtime hook is installing that bridge. Built-in artifact runtime
behavior is owned by generated artifacts and the Montage API; the SDK only
routes capabilities you explicitly register on the adapter.

```ts
import {
  createMontageAdapter,
  bindMontageCapabilityBridge,
} from "@montage/sdk";

const adapter = createMontageAdapter({
  agent: { id: "ops", name: "Ops Agent" },
  capabilities: [
    {
      name: "fetchEmails",
      effect: "query",
      description: "Fetch recent email summaries.",
      availability: "adapter",
    },
  ],
  async invokeCapability(request) {
    if (request.name === "fetchEmails") {
      return fetchEmails(request.args?.[0]);
    }
    throw new Error(`Unknown capability: ${request.name}`);
  },
});

const cleanup = bindMontageCapabilityBridge({ adapter });
```

## Error handling

API failures surface as `MontageApiError` (network / non-2xx / non-JSON
response). Validation problems inside the SDK surface as `MontageError` with a
typed `code`.

```ts
import { MontageApiError, MontageError } from "@montage/sdk";

try {
  await montage.execute({ prompt: "...", dataInfo: "{}" });
} catch (error) {
  if (error instanceof MontageApiError) {
    console.error(`API ${error.status} (${error.code}):`, error.message);
  } else if (error instanceof MontageError) {
    console.error(`SDK ${error.code}:`, error.message);
  }
}
```

The Montage API returns errors as
`{ success: false, error: { code, message } }`. The SDK reads the nested
`error` envelope and exposes `code` / `message` directly on the thrown
`MontageApiError`.

## License

[MIT](./LICENSE)
