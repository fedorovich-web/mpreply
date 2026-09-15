import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const tuning = readFileSync(join(root, "styles/public-mockup-render-tuning.css"), "utf8");

describe("approved render-derived public scale", () => {
  it("keeps hero scenes compact like the approved mockups", () => {
    expect(tuning).toContain(".mockup-page .features-mockup-scene");
    expect(tuning).toContain("min-height: 290px");
    expect(tuning).toContain(".mockup-page .marketplace-hub-scene");
    expect(tuning).toContain("min-height: 330px");
    expect(tuning).toContain(".mockup-page .marketplace-detail-render");
    expect(tuning).toContain("min-height: 340px");
    expect(tuning).toContain(".mockup-page .demo-hero-story");
    expect(tuning).toContain("min-height: 300px");
  });

  it("uses render-sized feature and workflow cards instead of oversized legacy cards", () => {
    expect(tuning).toContain("min-height: 148px");
    expect(tuning).toContain("min-height: 150px");
    expect(tuning).toContain("min-height: 164px");
    expect(tuning).toContain("min-height: 390px");
    expect(tuning).toContain("width: 44px");
    expect(tuning).toContain("height: 44px");
  });

  it("keeps demo full-process panels compact", () => {
    expect(tuning).toContain(".mockup-page .demo-process > div");
    expect(tuning).toContain("min-height: 230px");
  });
});
