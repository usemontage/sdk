import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    tools: "src/tools.ts",
    integrations: "src/integrations.ts",
    "agent-adapter": "src/agent-adapter.ts",
    "agent-actions": "src/agent-actions.ts",
    "capability-bridge": "src/capability-bridge.ts",
    "html/index": "src/html/index.ts",
    "html/mount-html-block": "src/html/mount-html-block.ts",
    "html/mount-iframe-html-block": "src/html/mount-iframe-html-block.ts",
    "react/index": "src/react/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  external: ["react", "react-dom"],
});

