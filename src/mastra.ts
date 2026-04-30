import { mastra, type ZodLike } from "./integrations";
import type {
  MontageGenerateInput,
  MontageGenerateResult,
  MontageToolkit,
} from "./tools";

export interface MontageMastraTool {
  id: "montage_generate";
  description: string;
  inputSchema: unknown;
  execute(
    input:
      | MontageGenerateInput
      | { context?: MontageGenerateInput; input?: MontageGenerateInput },
  ): Promise<MontageGenerateResult>;
}

export function createMontageMastraTool(
  toolkit: MontageToolkit,
  z: ZodLike,
): MontageMastraTool {
  return mastra(toolkit, z) as MontageMastraTool;
}

export const montageMastraTool = createMontageMastraTool;

