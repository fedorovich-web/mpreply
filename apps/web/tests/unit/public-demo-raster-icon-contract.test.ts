import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const entry = readFileSync(join(root, "components/public-site/DemoEntry.tsx"), "utf8");
const icon = readFileSync(join(root, "components/public-site/PublicIcon.tsx"), "utf8");
const css = readFileSync(join(root, "styles/public-approved-raster-icons.css"), "utf8");

describe("demo entry and shared public icon ownership", () => {
  it("uses the real brand mark and live feedback instead of a raster journey", () => {
    expect(entry).toContain("<PublicBrandMark />");
    expect(entry).toContain('<h1 id="demo-entry-title">{labels.title}</h1>');
    expect(entry).toContain('role="status"');
    expect(entry).toContain('role="alert"');
    expect(entry).not.toMatch(/demo-journey|demo-team-tool|demo-process|<Image/);
  });
  it("keeps icon artwork in the shared semantic mapping without positional demo replacements", () => {
    expect(icon).toContain('message: "/images/icons/final/05-chat.avif"');
    expect(icon).toContain('sparkles: "/images/icons/final/10-ai-draft.avif"');
    expect(css).not.toContain("/images/mockups/demo-icons/");
    expect(css).not.toMatch(/nth-child\(/);
    expect(css).toContain("background-size: contain");
  });
});
