// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { createMontageStreamSurface } from "../tools";

afterEach(() => {
  document.body.innerHTML = "";
});

function slotOrder(target: HTMLElement): string[] {
  return Array.from(
    target.querySelectorAll<HTMLElement>("[data-mtg-stream-slot]"),
  ).map((el) => el.getAttribute("data-mtg-stream-slot") ?? "");
}

describe("streaming slot ordering", () => {
  it("places out-of-order slots without placeholders in layout (ordinal) order", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const surface = createMontageStreamSurface(target);

    // Slots arrive out of order and the shell never declared placeholders.
    await surface.applyEvent({
      type: "slot",
      slot: "section-3",
      html: "<p>three</p>",
    } as never);
    await surface.applyEvent({
      type: "slot",
      slot: "section-1",
      html: "<p>one</p>",
    } as never);
    await surface.applyEvent({
      type: "slot",
      slot: "section-2",
      html: "<p>two</p>",
    } as never);

    expect(slotOrder(target)).toEqual(["section-1", "section-2", "section-3"]);
    surface.cleanup();
  });

  it("appends non-numeric slots in arrival order after numbered ones", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const surface = createMontageStreamSurface(target);

    await surface.applyEvent({
      type: "slot",
      slot: "section-2",
      html: "<p>two</p>",
    } as never);
    await surface.applyEvent({
      type: "slot",
      slot: "html-app",
      html: "<p>app</p>",
    } as never);
    await surface.applyEvent({
      type: "slot",
      slot: "section-1",
      html: "<p>one</p>",
    } as never);

    // Numbered slots sort; the non-numeric one keeps its (appended) position.
    expect(slotOrder(target)).toEqual(["section-1", "section-2", "html-app"]);
    surface.cleanup();
  });

  it("re-patches an existing slot in place rather than duplicating it", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const surface = createMontageStreamSurface(target);

    await surface.applyEvent({
      type: "slot",
      slot: "section-1",
      html: "<p>partial</p>",
    } as never);
    await surface.applyEvent({
      type: "slot",
      slot: "section-1",
      html: "<p>complete</p>",
    } as never);

    expect(slotOrder(target)).toEqual(["section-1"]);
    expect(target.textContent).toContain("complete");
    expect(target.textContent).not.toContain("partial");
    surface.cleanup();
  });
});
