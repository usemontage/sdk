export interface HtmlBlockPayload {
  html?: string;
  fragment?: string;
  styles?: string;
  stylesheets?: string[];
  scripts?: string[];
  externalScripts?: string[];
}

export interface NormalizedHtmlBlockPayload {
  fragment: string;
  styles?: string;
  stylesheets?: string[];
  scripts?: string[];
  externalScripts?: string[];
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

export function extractHtmlBlockPayload(html: string): NormalizedHtmlBlockPayload {
  const stylesheets: string[] = [];
  const scripts: string[] = [];
  const externalScripts: string[] = [];
  const styles: string[] = [];

  let withoutAssets = html.replace(
    /<link\b[^>]*?\brel=(["'])stylesheet\1[^>]*>/gi,
    (match) => {
      const hrefMatch = match.match(/\bhref=(["'])(.*?)\1/i);
      if (hrefMatch && hrefMatch[2]?.trim()) {
        stylesheets.push(hrefMatch[2].trim());
      }
      return "";
    },
  );

  withoutAssets = withoutAssets.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_match, css: string) => {
    if (css.trim()) {
      styles.push(css.trim());
    }
    return "";
  });

  withoutAssets = withoutAssets.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (_match, attrs: string, source: string) => {
    const srcMatch = attrs.match(/\bsrc=(["'])(.*?)\1/i);
    if (srcMatch && srcMatch[2]?.trim()) {
      externalScripts.push(srcMatch[2].trim());
    } else if (source.trim()) {
      scripts.push(source.trim());
    }
    return "";
  });

  const bodyMatch = withoutAssets.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  let fragment = bodyMatch ? bodyMatch[1] ?? "" : withoutAssets;
  fragment = fragment
    .replace(/<!doctype\b[^>]*>/gi, "")
    .replace(/<html\b[^>]*>/gi, "")
    .replace(/<\/html>/gi, "")
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<body\b[^>]*>/gi, "")
    .replace(/<\/body>/gi, "")
    .trim();

  const normalizedStylesheets = uniqueStrings(stylesheets);
  const normalizedScripts = uniqueStrings(scripts);
  const normalizedExternalScripts = uniqueStrings(externalScripts);

  return {
    fragment,
    styles: styles.length > 0 ? styles.join("\n\n") : undefined,
    stylesheets: normalizedStylesheets.length > 0 ? normalizedStylesheets : undefined,
    scripts: normalizedScripts.length > 0 ? normalizedScripts : undefined,
    externalScripts: normalizedExternalScripts.length > 0 ? normalizedExternalScripts : undefined,
  };
}

export function normalizeHtmlBlockPayload(
  input: HtmlBlockPayload,
): NormalizedHtmlBlockPayload {
  const fromHtml = typeof input.html === "string"
    ? extractHtmlBlockPayload(input.html)
    : undefined;

  const styleParts = [
    fromHtml?.styles,
    typeof input.styles === "string" ? input.styles : undefined,
  ].filter((entry): entry is string => Boolean(entry && entry.trim()));

  const stylesheets = uniqueStrings([
    ...stringArray(fromHtml?.stylesheets),
    ...stringArray(input.stylesheets),
  ]);
  const scripts = uniqueStrings([
    ...stringArray(fromHtml?.scripts),
    ...stringArray(input.scripts),
  ]);
  const externalScripts = uniqueStrings([
    ...stringArray(fromHtml?.externalScripts),
    ...stringArray(input.externalScripts),
  ]);

  return {
    fragment: fromHtml?.fragment ?? input.fragment ?? "",
    styles: styleParts.length > 0 ? styleParts.join("\n\n") : undefined,
    stylesheets: stylesheets.length > 0 ? stylesheets : undefined,
    scripts: scripts.length > 0 ? scripts : undefined,
    externalScripts: externalScripts.length > 0 ? externalScripts : undefined,
  };
}
