import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import packageJson from "../package.json";
import * as sdk from "./index";

const sourceRoot = dirname(fileURLToPath(import.meta.url));
const publicSurfaceTestFile = relative(sourceRoot, fileURLToPath(import.meta.url));

const standardNamespace = ["st", "d"].join("");
const standardCapabilityFragments = [
  `${standardNamespace}.`,
  ["STD", "_CAPABILITY"].join(""),
  ["runtime", "-capabilities"].join(""),
];
const implementationLeakFragments = [
  ["flux", "ui"].join(""),
  ["packages", "montage"].join("/"),
  ["mono", "repo"].join(""),
  [["inter", "nal"].join(""), "source"].join(" "),
  [["inter", "nal"].join(""), "logic"].join(" "),
];

function collectExportTargets(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.values(value).flatMap((entry) => collectExportTargets(entry));
}

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) return collectSourceFiles(path);
    if (!entry.endsWith(".ts") && !entry.endsWith(".tsx")) return [];
    return [path];
  });
}

describe("package public surface", () => {
  it("points package metadata at public production surfaces", () => {
    expect(packageJson.homepage).toBe("https://usemontage.ai");
    expect(packageJson.repository).toEqual({
      type: "git",
      url: "git+https://github.com/usemontage/sdk.git",
    });
  });

  it("does not expose non-public URLs or paths through package docs", () => {
    const publicPackageFiles = [
      join(sourceRoot, "../package.json"),
      join(sourceRoot, "../README.md"),
      join(sourceRoot, "../CONTRIBUTING.md"),
      join(sourceRoot, "public-types.ts"),
    ];
    const forbiddenFragments = [
      ["github.com", ["montage", "dev"].join("-"), "montage"].join("/"),
      ["montage", "dev"].join("."),
      ["packages", "montage-sdk"].join("/"),
      [["inter", "nal"].join(""), "Montage", ["work", "space"].join("")].join(" "),
      ["Montage", ["inter", "nal"].join("")].join("-"),
    ];

    const offenders = publicPackageFiles.flatMap((filePath) => {
      const content = readFileSync(filePath, "utf8");
      return forbiddenFragments
        .filter((fragment) => content.includes(fragment))
        .map((fragment) => `${relative(sourceRoot, filePath)} contains ${fragment}`);
    });

    expect(offenders).toEqual([]);
  });

  it("publishes built dist entrypoints instead of source files", () => {
    expect(packageJson.main).toBe("./dist/index.js");
    expect(packageJson.types).toBe("./dist/index.d.ts");

    const exportsField = packageJson.exports as Record<string, unknown>;
    expect(Object.keys(exportsField)).not.toContain(`./${standardNamespace}-capabilities`);

    const exportTargets = Object.values(exportsField).flatMap((entry) =>
      collectExportTargets(entry),
    );
    expect(exportTargets.length).toBeGreaterThan(0);
    for (const target of exportTargets) {
      expect(target).toMatch(/^\.\/dist\//);
      expect(target).not.toContain("/src/");
    }
  });

  it("does not expose runtime capability internals from the root module", () => {
    expect(sdk).not.toHaveProperty(["STD", "_CAPABILITY_INDEX"].join(""));
    expect(sdk).not.toHaveProperty(["STD", "_CAPABILITY_SPECS"].join(""));
    expect(sdk).not.toHaveProperty("getStdCapabilityEffect");
    expect(sdk).not.toHaveProperty("isStdCapabilityRuntimeAvailable");
  });

  it("does not keep the standard capability catalog in SDK source", () => {
    const offenders = collectSourceFiles(sourceRoot)
      .filter((filePath) => relative(sourceRoot, filePath) !== publicSurfaceTestFile)
      .flatMap((filePath) => {
        const content = readFileSync(filePath, "utf8");
        const matches = standardCapabilityFragments.filter((fragment) =>
          content.includes(fragment),
        );
        return matches.map((fragment) => `${relative(sourceRoot, filePath)} contains ${fragment}`);
      });

    expect(offenders).toEqual([]);
  });

  it("does not mention backend implementation families in source or docs", () => {
    const publicFiles = [
      join(sourceRoot, "../package.json"),
      join(sourceRoot, "../README.md"),
      join(sourceRoot, "../CONTRIBUTING.md"),
      ...collectSourceFiles(sourceRoot).filter(
        (filePath) => relative(sourceRoot, filePath) !== publicSurfaceTestFile,
      ),
    ];

    const offenders = publicFiles.flatMap((filePath) => {
      const content = readFileSync(filePath, "utf8").toLowerCase();
      return implementationLeakFragments
        .filter((fragment) => content.includes(fragment))
        .map((fragment) => `${relative(sourceRoot, filePath)} contains ${fragment}`);
    });

    expect(offenders).toEqual([]);
  });
});
