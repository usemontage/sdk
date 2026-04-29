import { describe, expect, it } from "vitest";
import {
  extractHtmlBlockPayload,
  normalizeHtmlBlockPayload,
} from "./html-block-payload";

describe("html block payload normalization", () => {
  it("extracts a full HTML document into the legacy mount payload shape", () => {
    const payload = extractHtmlBlockPayload(`<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://cdn.example.com/a.css">
  <style>.card { color: red; }</style>
</head>
<body>
  <section class="card">Bundled</section>
  <script>window.__seen = true;</script>
</body>
</html>`);

    expect(payload.fragment).toBe('<section class="card">Bundled</section>');
    expect(payload.styles).toBe(".card { color: red; }");
    expect(payload.stylesheets).toEqual(["https://cdn.example.com/a.css"]);
    expect(payload.scripts).toEqual(["window.__seen = true;"]);
  });

  it("prefers bundled HTML for content while merging explicit legacy assets", () => {
    const payload = normalizeHtmlBlockPayload({
      html: "<html><head><style>.a{}</style></head><body><div>A</div></body></html>",
      fragment: "<div>legacy</div>",
      styles: ".b{}",
      stylesheets: ["https://cdn.example.com/a.css"],
      scripts: ["window.b = true;"],
    });

    expect(payload.fragment).toBe("<div>A</div>");
    expect(payload.styles).toBe(".a{}\n\n.b{}");
    expect(payload.stylesheets).toEqual(["https://cdn.example.com/a.css"]);
    expect(payload.scripts).toEqual(["window.b = true;"]);
  });
});
