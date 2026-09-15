import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const features = readFileSync(join(root, "app/features/page.tsx"), "utf8");
const decorativeCss = readFileSync(join(root, "styles/public-mockup-decorative-fidelity.css"), "utf8");

describe("approved features hero console", () => {
  it("uses the sidebar plus unified queue composition from the render", () => {
    expect(features).toContain("features-app-sidebar");
    expect(features).toContain("features-app-brand");
    expect(features).toContain("PublicBrandMark");
    expect(features).toContain("features-app-main");
    expect(features).not.toContain("features-draft-pane");
    expect(features).not.toContain("features-draft-card");
  });

  it("keeps both handwritten annotations from the approved hero", () => {
    expect(features).toContain("features-hero-note-primary");
    expect(features).toContain("Все обращения");
    expect(features).toContain("features-hero-note-ai");
    expect(features).toContain("Быстрые и точные ответы");
    expect(decorativeCss).toContain(".features-hero-note-primary");
    expect(decorativeCss).toContain(".features-hero-note-ai");
  });
});
