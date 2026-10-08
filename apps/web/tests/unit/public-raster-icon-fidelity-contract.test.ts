import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const features = readFileSync(join(root, "app/features/page.tsx"), "utf8");
const icon = readFileSync(join(root, "components/public-site/PublicIcon.tsx"), "utf8");
const css = readFileSync(join(root, "styles/public-approved-raster-icons.css"), "utf8");

describe("shared supplied feature icon fidelity", () => {
  it("loads the raster sizing layer after the mockup CSS stack", () => {
    expect(layout.indexOf('import "../styles/public-approved-raster-icons.css"')).toBeGreaterThan(layout.indexOf('import "../styles/public-mockup-fidelity.css"'));
  });
  it("renders all tools with semantic supplied icons instead of positional replacements", () => {
    expect(features).toContain("features-tool-grid");
    expect(features).toContain("tools.map");
    expect(features).toContain("<PublicIcon name={tool.icon} />");
    for (const [name, asset] of [["inbox", "07-envelope-reply"], ["sparkles", "10-ai-draft"], ["shield-check", "12-quality-shield"], ["lightning", "30-speedometer"], ["document", "06-reply-document"], ["chart", "14-analytics-growth"], ["users", "19-team-users"], ["clock", "16-history-clock"]]) {
      expect(features).toContain('icon: "' + name + '"');
      expect(icon).toContain("/images/icons/final/" + asset + ".avif");
    }
    expect(css).not.toContain("nth-child");
    expect(css).not.toContain("/images/mockups/features-icons/");
  });
  it("fits complete icon artwork to the 44px feature chip without cropping or hiding it", () => {
    expect(css).toContain(".mockup-page .features-tool-card .mockup-icon-chip > .public-icon-image");
    expect(css).toContain("width: 44px");
    expect(css).toContain("height: 44px");
    expect(css).toContain("background-size: contain");
    expect(css).not.toContain("display: none");
    expect(css).not.toContain("background-size: cover");
  });
});
