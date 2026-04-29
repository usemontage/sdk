import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/tools.ts",
    "src/integrations.ts",
    "src/agent-adapter.ts",
    "src/capability-bridge.ts",
    "src/std-capabilities.ts",
    "src/html/mount-html-block.ts",
    "src/react/index.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  external: ["react", "react-dom"],
  splitting: true,
});
