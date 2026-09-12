import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const page = readFileSync(join(root, "app/page.tsx"), "utf8");
const tokens = readFileSync(join(root, "styles/tokens.css"), "utf8");
const publicCss = readFileSync(join(root, "styles/public-site.css"), "utf8");

describe("public homepage redesign contract", () => {
  it("contains the approved product-story sections", () => {
    expect(page).toContain("homepage-workspace");
    expect(page).toContain("homepage-ai-layer");
    expect(page).toContain("homepage-process");
    expect(page).toContain("homepage-outcomes");
    expect(page).toContain("homepage-final-cta");
  });

  it("does not fabricate customer proof or unsupported model providers", () => {
    expect(page).not.toMatch(/50K\+|довольных клиентов|GPT-5\.6|Claude Sonnet 5|Gemini 3\.8|DeepSeek V4/i);
  });

  it("uses the approved blue public tokens and spacious section rhythm", () => {
    expect(tokens).toContain("--color-brand-primary: #2563eb");
    expect(tokens).toContain("--gradient-public-blue");
    expect(tokens).toMatch(/--public-section-spacing:\s*clamp\([^;]*6rem[^;]*9rem\)/);
    expect(publicCss).toContain(".homepage-process");
  });
});
