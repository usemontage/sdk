import { vercelAi, type ZodLike } from "./integrations";
import type {
  MontageGenerateInput,
  MontageGenerateResult,
  MontageToolkit,
} from "./tools";

export interface MontageAiSdkToolConfig {
  description: string;
  inputSchema: unknown;
  parameters: unknown;
  execute(
    input:
      | MontageGenerateInput
      | { context?: MontageGenerateInput; input?: MontageGenerateInput },
  ): Promise<MontageGenerateResult>;
}

export function createMontageAiSdkTool(
  toolkit: MontageToolkit,
  z: ZodLike,
): MontageAiSdkToolConfig {
  return vercelAi(toolkit, z) as MontageAiSdkToolConfig;
}

export const createMontageVercelAiTool = createMontageAiSdkTool;
export const montageAiSdkTool = createMontageAiSdkTool;

