import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const brandCss = readFileSync(join(root, "styles/public-mockup-brand-fidelity.css"), "utf8");

describe("late mockup brand normalization", () => {
  it("keeps demo accents on the approved MPReply primary after later fidelity layers", () => {
    expect(brandCss).toContain(".public-root:has(.mockup-page) .mockup-page .demo-scenario-popular");
    expect(brandCss).toContain(".public-root:has(.mockup-page) .mockup-page .demo-story-ai-avatar");
    expect(brandCss).toContain(".public-root:has(.mockup-page) .mockup-page .demo-story-review-avatar");
    expect(brandCss).toContain(".public-root:has(.mockup-page) .mockup-page .demo-process-event-icon.purple");
    expect(brandCss).toContain("color: #5148e8");
  });
});
