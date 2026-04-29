/**
 * Public types and minimal helpers used by the SDK's API-driven surface.
 *
 * Inlined here so the published `@montage/sdk` package does not depend on
 * any internal Montage workspace packages. These are TypeScript types only, plus a
 * couple of small validators / normalizers that the adapter layer uses at
 * runtime — no Zod schemas, no Montage-internal imports.
 */

// ── Design system types ────────────────────────────────────────────────

export type DesignSystemTheme = "light" | "dark" | "auto";

export type DesignSystemDensity = "compact" | "default" | "relaxed";

export type MontageDesignSystemSourceKind =
  | "preset"
  | "generated"
  | "reference-site"
  | "reference-image"
  | "brief";

export interface MontageDesignSystemSource {
  kind: MontageDesignSystemSourceKind;
  siteUrl?: string;
  imageUrl?: string;
  description?: string;
}

export interface DesignSystemColors {
  background: string;
  backgroundSubtle: string;
  surface: string;
  surfaceHover: string;
  surfaceActive: string;
  primary: string;
  primaryHover: string;
  primarySubtle: string;
  secondary: string;
  secondarySubtle: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderSubtle: string;
  focus: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
}

export type DesignSystemColorOverrides = Partial<DesignSystemColors>;

export interface MontageDesignSystem {
  id: string;
  label: string;
  theme?: DesignSystemTheme;
  palette?: string;
  colors?: DesignSystemColors;
  typography?: string;
  density?: DesignSystemDensity;
  mood?: string;
  source?: MontageDesignSystemSource;
}

export interface MontageDesignSystemConfig {
  id?: string;
  label?: string;
  theme?: DesignSystemTheme;
  palette?: string;
  colors?: DesignSystemColorOverrides;
  typography?: string;
  density?: DesignSystemDensity;
  mood?: string;
  source?: Partial<MontageDesignSystemSource>;
}

export const DEFAULT_MONTAGE_DESIGN_SYSTEM: MontageDesignSystem = {
  id: "preset:montage-default",
  label: "Montage Default",
  theme: "light",
  palette: "Notion",
  typography: "Inter",
  density: "default",
  mood: "productive",
  colors: {
    background: "#FFFFFF",
    backgroundSubtle: "#FBFBFA",
    surface: "#FFFFFF",
    surfaceHover: "#F9FAFB",
    surfaceActive: "#F3F4F6",
    primary: "#191919",
    primaryHover: "#2D2D2D",
    primarySubtle: "rgba(25, 25, 25, 0.06)",
    secondary: "#6B6B64",
    secondarySubtle: "rgba(107, 107, 100, 0.06)",
    text: "#111827",
    textSecondary: "#374151",
    textMuted: "#6B7280",
    border: "#E5E7EB",
    borderSubtle: "#F3F4F6",
    focus: "#191919",
    success: "#059669",
    warning: "#D97706",
    danger: "#DC2626",
    info: "#6B6B64",
  },
  source: {
    kind: "preset",
  },
};

function slugifyDesignSystemId(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "custom";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isEmptyConfig(value: unknown): boolean {
  return (
    !value ||
    (isPlainObject(value) && Object.keys(value).length === 0)
  );
}

const VALID_THEME = new Set<DesignSystemTheme>(["light", "dark", "auto"]);
const VALID_DENSITY = new Set<DesignSystemDensity>([
  "compact",
  "default",
  "relaxed",
]);
const VALID_SOURCE_KINDS = new Set<MontageDesignSystemSourceKind>([
  "preset",
  "generated",
  "reference-site",
  "reference-image",
  "brief",
]);

function validateConfig(input: unknown): MontageDesignSystemConfig {
  if (!isPlainObject(input)) {
    throw new Error("designSystem must be an object.");
  }
  const record = input as Record<string, unknown>;

  if (
    record.theme !== undefined &&
    !VALID_THEME.has(record.theme as DesignSystemTheme)
  ) {
    throw new Error(`designSystem.theme must be light, dark, or auto.`);
  }
  if (
    record.density !== undefined &&
    !VALID_DENSITY.has(record.density as DesignSystemDensity)
  ) {
    throw new Error(`designSystem.density must be compact, default, or relaxed.`);
  }
  if (record.colors !== undefined && !isPlainObject(record.colors)) {
    throw new Error("designSystem.colors must be an object.");
  }
  if (record.source !== undefined && !isPlainObject(record.source)) {
    throw new Error("designSystem.source must be an object.");
  }
  if (
    isPlainObject(record.source) &&
    record.source.kind !== undefined &&
    !VALID_SOURCE_KINDS.has(record.source.kind as MontageDesignSystemSourceKind)
  ) {
    throw new Error(
      "designSystem.source.kind must be preset, generated, reference-site, reference-image, or brief.",
    );
  }
  for (const key of [
    "id",
    "label",
    "palette",
    "typography",
    "mood",
  ] as const) {
    if (record[key] !== undefined && typeof record[key] !== "string") {
      throw new Error(`designSystem.${key} must be a string.`);
    }
  }

  return record as MontageDesignSystemConfig;
}

/**
 * Normalizes a partial design-system config into a full
 * `MontageDesignSystem`. Mirrors the implementation in `@montage/schema` but
 * uses native validation instead of Zod so the SDK has no schema dep.
 */
export function normalizeMontageDesignSystem(
  input?: MontageDesignSystem | MontageDesignSystemConfig | null,
): MontageDesignSystem {
  const emptyInput = isEmptyConfig(input);
  if (emptyInput) {
    return {
      ...DEFAULT_MONTAGE_DESIGN_SYSTEM,
      colors: { ...(DEFAULT_MONTAGE_DESIGN_SYSTEM.colors as DesignSystemColors) },
      source: DEFAULT_MONTAGE_DESIGN_SYSTEM.source
        ? { ...DEFAULT_MONTAGE_DESIGN_SYSTEM.source }
        : undefined,
    };
  }

  const parsed = validateConfig(input);
  const label =
    parsed.label ?? parsed.palette ?? DEFAULT_MONTAGE_DESIGN_SYSTEM.label;
  const idSeed = parsed.label
    ? parsed.label
    : [
        label,
        parsed.theme,
        parsed.palette,
        parsed.typography,
        parsed.density,
      ]
        .filter(Boolean)
        .join(" ");
  const id = parsed.id ?? `custom:${slugifyDesignSystemId(idSeed)}`;

  const hasCustomSource = Boolean(
    parsed.source && Object.keys(parsed.source).length > 0,
  );
  const source: MontageDesignSystemSource | undefined = hasCustomSource
    ? {
        kind: parsed.source?.kind ?? "brief",
        siteUrl: parsed.source?.siteUrl,
        imageUrl: parsed.source?.imageUrl,
        description: parsed.source?.description,
      }
    : id === DEFAULT_MONTAGE_DESIGN_SYSTEM.id
      ? DEFAULT_MONTAGE_DESIGN_SYSTEM.source
      : { kind: "brief" };

  return {
    ...DEFAULT_MONTAGE_DESIGN_SYSTEM,
    ...parsed,
    id,
    label,
    colors: {
      ...(DEFAULT_MONTAGE_DESIGN_SYSTEM.colors as DesignSystemColors),
      ...(parsed.colors ?? {}),
    } as DesignSystemColors,
    source,
  };
}
