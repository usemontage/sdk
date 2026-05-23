import type { MontageToolkit } from "../tools";
import { createJsonSchemaTool } from "./tool-schema";

export function agno(toolkit: MontageToolkit) {
  return createJsonSchemaTool(toolkit);
}

