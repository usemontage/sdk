import type {
  ArtifactRef,
  JobRef,
  MontageCapabilityEffect,
  MontageCapabilitySpec,
} from "./types";

export const STD_CAPABILITY_SPECS: readonly MontageCapabilitySpec[] = [
  { name: "std.data.filter", effect: "pure", description: "Filter generic records in memory.", availability: "runtime" },
  { name: "std.data.sort", effect: "pure", description: "Sort generic records in memory.", availability: "runtime" },
  { name: "std.data.group", effect: "pure", description: "Group generic records by a field.", availability: "runtime" },
  { name: "std.data.aggregate", effect: "pure", description: "Aggregate generic records.", availability: "runtime" },
  { name: "std.collection.get", effect: "query", description: "Read an in-memory/session collection.", availability: "runtime" },
  { name: "std.collection.query", effect: "query", description: "Query an in-memory/session collection.", availability: "runtime" },
  { name: "std.collection.set", effect: "effect", description: "Replace an in-memory/session collection.", availability: "runtime" },
  { name: "std.collection.upsert", effect: "effect", description: "Upsert rows into an in-memory/session collection.", availability: "runtime" },
  { name: "std.collection.remove", effect: "effect", description: "Remove rows from an in-memory/session collection.", availability: "runtime" },
  { name: "std.file.importRows", effect: "effect", description: "Import rows from CSV, JSON, text, or File input.", availability: "runtime" },
  { name: "std.artifact.export", effect: "effect", description: "Export JSON/CSV/HTML artifacts in the browser runtime.", availability: "runtime" },
  { name: "std.artifact.download", effect: "effect", description: "Download or mark an artifact for download.", availability: "runtime" },
  { name: "std.job.status", effect: "query", description: "Read a runtime job status.", availability: "runtime" },
  { name: "std.job.cancel", effect: "effect", description: "Cancel a runtime job.", availability: "runtime" },
  { name: "std.notify.toast", effect: "effect", description: "Dispatch a runtime toast notification.", availability: "runtime" },
  { name: "std.http.fetch", effect: "effect", description: "Brokered HTTP fetch. Requires adapter implementation.", availability: "declared" },
  { name: "std.ai.extract", effect: "effect", description: "Brokered AI extraction. Requires adapter implementation.", availability: "declared" },
  { name: "std.ai.classify", effect: "effect", description: "Brokered AI classification. Requires adapter implementation.", availability: "declared" },
  { name: "std.ai.summarize", effect: "effect", description: "Brokered AI summarization. Requires adapter implementation.", availability: "declared" },
  { name: "std.artifact.pdf", effect: "effect", description: "PDF artifact generation. Requires adapter implementation.", availability: "declared" },
  { name: "std.artifact.xlsx", effect: "effect", description: "XLSX artifact generation. Requires adapter implementation.", availability: "declared" },
  { name: "std.artifact.docx", effect: "effect", description: "DOCX artifact generation. Requires adapter implementation.", availability: "declared" },
];

export const STD_CAPABILITY_INDEX: Readonly<Record<string, MontageCapabilitySpec>> =
  Object.freeze(Object.fromEntries(STD_CAPABILITY_SPECS.map((spec) => [spec.name, spec])));

interface StandardRuntimeState {
  collections: Map<string, unknown[]>;
  artifacts: Map<string, ArtifactRef>;
  jobs: Map<string, JobRef>;
  nextArtifactId: number;
  nextJobId: number;
}

export function createStandardRuntimeState(): StandardRuntimeState {
  return {
    collections: new Map(),
    artifacts: new Map(),
    jobs: new Map(),
    nextArtifactId: 1,
    nextJobId: 1,
  };
}

export function getStdCapabilityEffect(name: string): MontageCapabilityEffect | undefined {
  return STD_CAPABILITY_INDEX[name]?.effect;
}

export function isStdCapabilityRuntimeAvailable(name: string): boolean {
  return STD_CAPABILITY_INDEX[name]?.availability === "runtime";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function textMatches(value: unknown, search: string): boolean {
  return String(value ?? "").toLowerCase().includes(search.toLowerCase());
}

function readField(row: unknown, key: string): unknown {
  if (!isRecord(row)) return undefined;
  return row[key];
}

function normalizeRows(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function applyFilter(rows: unknown[], options: unknown): unknown[] {
  if (!isRecord(options)) return rows;
  const search = typeof options.search === "string" ? options.search.trim() : "";
  const fields = Array.isArray(options.fields)
    ? options.fields.filter((field): field is string => typeof field === "string")
    : [];
  const equals = isRecord(options.equals) ? options.equals : {};

  return rows.filter((row) => {
    const matchesSearch = !search || (
      fields.length > 0
        ? fields.some((field) => textMatches(readField(row, field), search))
        : textMatches(row, search)
    );
    const matchesEquals = Object.entries(equals).every(([key, value]) => readField(row, key) === value);
    return matchesSearch && matchesEquals;
  });
}

function applySort(rows: unknown[], options: unknown): unknown[] {
  if (!isRecord(options) || typeof options.key !== "string") return rows;
  const direction = options.direction === "desc" ? -1 : 1;
  return [...rows].sort((left, right) => {
    const leftValue = readField(left, options.key as string);
    const rightValue = readField(right, options.key as string);
    return String(leftValue ?? "").localeCompare(String(rightValue ?? "")) * direction;
  });
}

function rowsToCsv(rows: unknown[]): string {
  const keys = Array.from(new Set(rows.flatMap((row) => isRecord(row) ? Object.keys(row) : [])));
  if (keys.length === 0) return "";
  const quote = (value: unknown) => {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
  };
  return [
    keys.map(quote).join(","),
    ...rows.map((row) => keys.map((key) => quote(readField(row, key))).join(",")),
  ].join("\n");
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === "\"" && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        cells.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current);
    return cells;
  };
  const headers = parseLine(lines[0] ?? "");
  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

async function readImportInput(input: unknown): Promise<string> {
  if (typeof input === "string") return input;
  if (isRecord(input) && typeof input.text === "string") return input.text;
  if (input && typeof (input as { text?: unknown }).text === "function") {
    return String(await (input as { text(): Promise<string> }).text());
  }
  return "";
}

function createArtifact(
  state: StandardRuntimeState,
  kind: ArtifactRef["kind"],
  name: string,
  content: string,
  mimeType: string,
): ArtifactRef {
  const id = `artifact_${state.nextArtifactId}`;
  state.nextArtifactId += 1;
  let url: string | undefined;
  if (typeof Blob !== "undefined" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  }
  const artifact: ArtifactRef = {
    id,
    kind,
    name,
    mimeType,
    url,
    previewHtml: kind === "html" ? content : undefined,
    metadata: { bytes: content.length },
  };
  state.artifacts.set(id, artifact);
  return artifact;
}

export function invokeStdCapability(
  state: StandardRuntimeState,
  name: string,
  effect: MontageCapabilityEffect,
  args: unknown[],
): Promise<unknown> | unknown {
  const spec = STD_CAPABILITY_INDEX[name];
  if (!spec) {
    throw new Error(`Unknown standard capability "${name}".`);
  }
  if (spec.effect !== effect) {
    throw new Error(`Standard capability "${name}" is "${spec.effect}", not "${effect}".`);
  }
  if (spec.availability !== "runtime") {
    throw new Error(`Standard capability "${name}" requires an adapter implementation.`);
  }

  switch (name) {
    case "std.data.filter":
      return applyFilter(normalizeRows(args[0]), args[1]);
    case "std.data.sort":
      return applySort(normalizeRows(args[0]), args[1]);
    case "std.data.group": {
      const key = typeof args[1] === "string" ? args[1] : isRecord(args[1]) && typeof args[1].key === "string" ? args[1].key : "";
      return normalizeRows(args[0]).reduce<Record<string, unknown[]>>((groups, row) => {
        const groupKey = String(readField(row, key) ?? "");
        groups[groupKey] = [...(groups[groupKey] ?? []), row];
        return groups;
      }, {});
    }
    case "std.data.aggregate": {
      const rows = normalizeRows(args[0]);
      const key = isRecord(args[1]) && typeof args[1].key === "string" ? args[1].key : "";
      const op = isRecord(args[1]) && typeof args[1].op === "string" ? args[1].op : "count";
      if (op === "sum") {
        return rows.reduce<number>((total, row) => total + Number(readField(row, key) ?? 0), 0);
      }
      if (op === "avg") {
        return rows.length
          ? rows.reduce<number>((total, row) => total + Number(readField(row, key) ?? 0), 0) / rows.length
          : 0;
      }
      return rows.length;
    }
    case "std.collection.get":
      return [...(state.collections.get(String(args[0] ?? "")) ?? [])];
    case "std.collection.query": {
      const rows = [...(state.collections.get(String(args[0] ?? "")) ?? [])];
      return applySort(applyFilter(rows, args[1]), args[1]);
    }
    case "std.collection.set": {
      const nameArg = String(args[0] ?? "");
      const rows = normalizeRows(args[1]);
      state.collections.set(nameArg, rows);
      return rows;
    }
    case "std.collection.upsert": {
      const nameArg = String(args[0] ?? "");
      const rows = normalizeRows(args[1]);
      const key = typeof args[2] === "string" ? args[2] : "id";
      const current = state.collections.get(nameArg) ?? [];
      const byKey = new Map(current.map((row) => [readField(row, key), row]));
      for (const row of rows) byKey.set(readField(row, key), row);
      const nextRows = [...byKey.values()];
      state.collections.set(nameArg, nextRows);
      return nextRows;
    }
    case "std.collection.remove": {
      const nameArg = String(args[0] ?? "");
      const current = state.collections.get(nameArg) ?? [];
      const ids = new Set(Array.isArray(args[1]) ? args[1] : [args[1]]);
      const nextRows = current.filter((row) => !ids.has(readField(row, "id")));
      state.collections.set(nameArg, nextRows);
      return nextRows;
    }
    case "std.file.importRows": {
      const format = isRecord(args[1]) && typeof args[1].format === "string" ? args[1].format : "";
      return readImportInput(args[0]).then((text) => {
        if (format === "json" || text.trim().startsWith("[") || text.trim().startsWith("{")) {
          const parsed = JSON.parse(text);
          return Array.isArray(parsed) ? parsed : [parsed];
        }
        return parseCsv(text);
      });
    }
    case "std.artifact.export": {
      const options = isRecord(args[0]) ? args[0] : { format: args[0], data: args[1] };
      const format = String(options.format ?? "json") as ArtifactRef["kind"];
      const data = options.data;
      const nameArg = String(options.name ?? `montage-export.${format}`);
      if (format === "csv") return createArtifact(state, "csv", nameArg, rowsToCsv(normalizeRows(data)), "text/csv");
      if (format === "html") return createArtifact(state, "html", nameArg, String(data ?? ""), "text/html");
      return createArtifact(state, "json", nameArg, JSON.stringify(data ?? null, null, 2), "application/json");
    }
    case "std.artifact.download":
      return { ok: true, artifact: args[0] };
    case "std.job.status":
      return state.jobs.get(String(args[0] ?? "")) ?? null;
    case "std.job.cancel": {
      const id = String(args[0] ?? "");
      const job = state.jobs.get(id) ?? { id, status: "cancelled" as const };
      const nextJob: JobRef = { ...job, status: "cancelled" };
      state.jobs.set(id, nextJob);
      return nextJob;
    }
    case "std.notify.toast": {
      const message = isRecord(args[0]) ? String(args[0].message ?? "") : String(args[0] ?? "");
      if (typeof document !== "undefined") {
        document.dispatchEvent(new CustomEvent("montage:toast", { detail: { message, input: args[0] } }));
      }
      return { ok: true, message };
    }
    default:
      throw new Error(`Standard capability "${name}" is not implemented.`);
  }
}
