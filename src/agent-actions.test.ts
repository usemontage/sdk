import { describe, expect, it } from "vitest";
import {
  dispatchMontageAgentAction,
  installMontageAgentActionHandler,
  isMontageAgentActionRequest,
  MONTAGE_AGENT_ACTION_EVENT,
} from "./agent-actions";

describe("agent action contract", () => {
  it("validates Montage agent action requests", () => {
    expect(isMontageAgentActionRequest({
      action: "render_ui",
      instruction: "Render a follow-up chart.",
    })).toBe(true);
    expect(isMontageAgentActionRequest({
      action: "render_ui",
      instruction: "",
    })).toBe(false);
  });

  it("dispatches artifact agent actions to an installed host handler", async () => {
    const target = new EventTarget();
    const uninstall = installMontageAgentActionHandler(target, async (request) => {
      expect(request).toMatchObject({
        artifactId: "art_1",
        action: "patch_artifact",
        instruction: "Add a risk tab.",
      });
      return {
        type: "patch",
        artifactId: "art_1",
        revisionId: "rev_2",
        summary: "Added risk tab.",
      };
    });

    const result = await dispatchMontageAgentAction(target, {
      artifactId: "art_1",
      action: "patch_artifact",
      instruction: "Add a risk tab.",
    });

    uninstall();
    expect(result).toEqual({
      type: "patch",
      artifactId: "art_1",
      revisionId: "rev_2",
      summary: "Added risk tab.",
    });
  });

  it("returns a structured unhandled result when no host listens", async () => {
    const result = await dispatchMontageAgentAction(new EventTarget(), {
      action: "answer",
      instruction: "Explain this anomaly.",
    });

    expect(result).toEqual({
      type: "error",
      code: "AGENT_ACTION_UNHANDLED",
      message: "No Montage agent action handler responded.",
    });
  });

  it("uses one event name for Collage and external host runtimes", () => {
    expect(MONTAGE_AGENT_ACTION_EVENT).toBe("montage:agent-action");
  });
});
