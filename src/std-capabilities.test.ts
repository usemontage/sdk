// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  createStandardRuntimeState,
  invokeStdCapability,
} from "./std-capabilities";
import type { ArtifactRef } from "./types";

describe("standard runtime capabilities", () => {
  it("filters, sorts, groups, and aggregates generic rows synchronously", () => {
    const state = createStandardRuntimeState();
    const rows = [
      { id: "1", name: "Acme", stage: "Qualified", value: 84 },
      { id: "2", name: "Globex", stage: "Proposal", value: 120 },
      { id: "3", name: "Momentum", stage: "Qualified", value: 62 },
    ];

    expect(invokeStdCapability(state, "std.data.filter", "pure", [
      rows,
      { search: "ac", fields: ["name"], equals: { stage: "Qualified" } },
    ])).toEqual([rows[0]]);
    expect(invokeStdCapability(state, "std.data.sort", "pure", [
      rows,
      { key: "name", direction: "desc" },
    ])).toEqual([rows[2], rows[1], rows[0]]);
    expect(invokeStdCapability(state, "std.data.group", "pure", [rows, "stage"])).toEqual({
      Proposal: [rows[1]],
      Qualified: [rows[0], rows[2]],
    });
    expect(invokeStdCapability(state, "std.data.aggregate", "pure", [
      rows,
      { key: "value", op: "sum" },
    ])).toBe(266);
  });

  it("supports in-memory collection query and mutation capabilities", async () => {
    const state = createStandardRuntimeState();

    await expect(invokeStdCapability(state, "std.collection.set", "effect", [
      "leads",
      [{ id: "a", name: "Acme" }],
    ])).toEqual([{ id: "a", name: "Acme" }]);
    await expect(invokeStdCapability(state, "std.collection.upsert", "effect", [
      "leads",
      [{ id: "b", name: "Beacon" }],
      "id",
    ])).toEqual([{ id: "a", name: "Acme" }, { id: "b", name: "Beacon" }]);
    await expect(invokeStdCapability(state, "std.collection.query", "query", [
      "leads",
      { search: "bea", fields: ["name"] },
    ])).toEqual([{ id: "b", name: "Beacon" }]);
    await expect(invokeStdCapability(state, "std.collection.remove", "effect", ["leads", "a"]))
      .toEqual([{ id: "b", name: "Beacon" }]);
  });

  it("imports CSV rows and exports JSON/CSV/HTML artifacts", async () => {
    const state = createStandardRuntimeState();
    const rows = await invokeStdCapability(state, "std.file.importRows", "effect", [
      "name,company\nAva,Acme\nMira,Globex",
      { format: "csv" },
    ]);

    expect(rows).toEqual([
      { name: "Ava", company: "Acme" },
      { name: "Mira", company: "Globex" },
    ]);

    const csv = invokeStdCapability(state, "std.artifact.export", "effect", [
      { format: "csv", name: "leads.csv", data: rows },
    ]) as ArtifactRef;
    const json = invokeStdCapability(state, "std.artifact.export", "effect", [
      { format: "json", name: "leads.json", data: rows },
    ]) as ArtifactRef;
    const html = invokeStdCapability(state, "std.artifact.export", "effect", [
      { format: "html", name: "lead.html", data: "<strong>Acme</strong>" },
    ]) as ArtifactRef;

    expect(csv).toMatchObject({ kind: "csv", name: "leads.csv", mimeType: "text/csv" });
    expect(json).toMatchObject({ kind: "json", name: "leads.json", mimeType: "application/json" });
    expect(html).toMatchObject({
      kind: "html",
      name: "lead.html",
      mimeType: "text/html",
      previewHtml: "<strong>Acme</strong>",
    });
  });

  it("surfaces declared-only and effect-mismatched standard capability failures", () => {
    const state = createStandardRuntimeState();

    expect(() => invokeStdCapability(state, "std.artifact.pdf", "effect", []))
      .toThrow("requires an adapter implementation");
    expect(() => invokeStdCapability(state, "std.data.filter", "effect", []))
      .toThrow("is \"pure\", not \"effect\"");
  });

  it("emits generic toast events and job cancellation results", () => {
    const state = createStandardRuntimeState();
    const listener = vi.fn();
    document.addEventListener("montage:toast", listener);

    expect(invokeStdCapability(state, "std.notify.toast", "effect", [{ message: "Saved" }]))
      .toEqual({ ok: true, message: "Saved" });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      detail: expect.objectContaining({ message: "Saved" }),
    }));
    expect(invokeStdCapability(state, "std.job.cancel", "effect", ["job_1"]))
      .toMatchObject({ id: "job_1", status: "cancelled" });
    expect(invokeStdCapability(state, "std.job.status", "query", ["job_1"]))
      .toMatchObject({ id: "job_1", status: "cancelled" });

    document.removeEventListener("montage:toast", listener);
  });
});
