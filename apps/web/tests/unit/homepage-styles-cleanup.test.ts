import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const approvedCss = readFileSync(join(process.cwd(), "styles/homepage-approved.css"), "utf8");

describe("homepage approved stylesheet", () => {
  it("does not keep the retired CSS hero mockup", () => {
    for (const legacySelector of [
      "homepage-hero-glow",
      "homepage-hero-window",
      "homepage-hero-ai-card",
      "homepage-hero-handnote",
      "homepage-mini-brand",
      "homepage-mini-nav",
      "homepage-window-row",
      "homepage-window-toolbar",
      "homepage-window-type",
    ]) {
      expect(approvedCss).not.toContain(legacySelector);
    }
  });

  it("does not rely on important overrides for homepage geometry", () => {
    expect(approvedCss).not.toContain("!important");
  });
});
