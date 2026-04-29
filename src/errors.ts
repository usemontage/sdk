import type {
  MontageErrorCode,
  MontageRenderError,
} from "./types";

/**
 * Typed runtime error used across the SDK's adapter and capability bridge
 * boundaries.
 */
export class MontageError extends Error implements MontageRenderError {
  code: MontageErrorCode;
  cause?: unknown;

  constructor(
    code: MontageErrorCode,
    message: string,
    options: {
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "MontageError";
    this.code = code;
    this.cause = options.cause;
  }
}
