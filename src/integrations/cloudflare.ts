import type { MontageToolkit } from "../tools";
import { createJsonSchemaTool } from "./tool-schema";

export function cloudflareAgent(toolkit: MontageToolkit) {
  return createJsonSchemaTool(toolkit);
}

