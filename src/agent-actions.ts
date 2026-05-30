export const MONTAGE_AGENT_ACTION_EVENT = "montage:agent-action";

export type MontageAgentActionName =
  | "create_artifact"
  | "patch_artifact"
  | "answer"
  | "render_ui"
  | "run_workflow";

export type MontageAgentActionMode =
  | "inline"
  | "modal"
  | "replace"
  | "new_artifact";

export interface MontageAgentActionRequest {
  id?: string;
  artifactId?: string;
  revisionId?: string;
  action: MontageAgentActionName;
  instruction: string;
  context?: unknown;
  ui?: {
    mode?: MontageAgentActionMode;
    target?: string;
  };
}

export type MontageAgentActionResult =
  | { type: "text"; content: string }
  | { type: "html"; html: string }
  | { type: "artifact"; artifactId: string; revisionId?: string; html?: string }
  | { type: "patch"; artifactId: string; revisionId: string; summary?: string }
  | { type: "error"; message: string; code?: string };

export type MontageAgentActionHandler = (
  request: MontageAgentActionRequest,
) => MontageAgentActionResult | Promise<MontageAgentActionResult>;

export interface MontageAgentActionEventDetail {
  request: MontageAgentActionRequest;
  respond(result: MontageAgentActionResult): void;
  reject(error: unknown): void;
}

export type MontageAgentActionEvent = Event & {
  detail: MontageAgentActionEventDetail;
};

export function isMontageAgentActionRequest(
  value: unknown,
): value is MontageAgentActionRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.action === "string"
    && typeof record.instruction === "string"
    && record.instruction.trim().length > 0;
}

function toAgentActionError(error: unknown): MontageAgentActionResult {
  if (error && typeof error === "object" && "message" in error) {
    return { type: "error", message: String((error as { message: unknown }).message) };
  }
  return { type: "error", message: String(error) };
}

function createAgentActionEvent(
  detail: MontageAgentActionEventDetail,
): MontageAgentActionEvent {
  const event = new Event(MONTAGE_AGENT_ACTION_EVENT, {
    bubbles: true,
    cancelable: true,
  }) as MontageAgentActionEvent;
  Object.defineProperty(event, "detail", {
    configurable: false,
    enumerable: true,
    value: detail,
  });
  return event;
}

export function dispatchMontageAgentAction(
  target: EventTarget,
  request: MontageAgentActionRequest,
): Promise<MontageAgentActionResult> {
  if (!isMontageAgentActionRequest(request)) {
    return Promise.resolve({
      type: "error",
      code: "INVALID_AGENT_ACTION",
      message: "Montage agent action request is invalid.",
    });
  }

  return new Promise((resolve) => {
    const event = createAgentActionEvent({
      request,
      respond: resolve,
      reject: (error) => resolve(toAgentActionError(error)),
    });
    const handled = target.dispatchEvent(event);
    if (handled) {
      resolve({
        type: "error",
        code: "AGENT_ACTION_UNHANDLED",
        message: "No Montage agent action handler responded.",
      });
    }
  });
}

export function installMontageAgentActionHandler(
  target: EventTarget,
  handler: MontageAgentActionHandler,
): () => void {
  const listener = (event: Event) => {
    const actionEvent = event as MontageAgentActionEvent;
    const detail = actionEvent.detail;
    if (!detail || !isMontageAgentActionRequest(detail.request)) return;
    event.preventDefault();
    void Promise.resolve(handler(detail.request))
      .then(detail.respond)
      .catch(detail.reject);
  };

  target.addEventListener(MONTAGE_AGENT_ACTION_EVENT, listener);
  return () => target.removeEventListener(MONTAGE_AGENT_ACTION_EVENT, listener);
}
