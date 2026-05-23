import type { MontageToolkit } from "../tools";
import { createJsonSchemaTool } from "./tool-schema";

export function strands(toolkit: MontageToolkit) {
  return createJsonSchemaTool(toolkit);
}

