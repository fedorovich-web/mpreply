import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const marketingPagesCss = readFileSync(join(root, "styles/marketing-pages.css"), "utf8");
const publicSiteCss = readFileSync(join(root, "styles/public-site.css"), "utf8");

describe("public CSS legacy contract", () => {
  it("does not keep overrides for superseded public marketing compositions", () => {
    const legacySelectors = [
      ".integration-status-panel-supported",
      ".resource-intro-panel",
      ".contact-channel-panel",
      ".decision-preview",
      ".demo-scenario-card",
      ".pricing-principle-panel",
    ];

    for (const selector of legacySelectors) {
      expect(marketingPagesCss).not.toContain(selector);
    }
  });

  it("keeps current shared public compositions available", () => {
    for (const selector of [
      ".marketplace-readiness-row-supported",
      ".marketplace-flow-layout",
      ".marketplace-detail-story",
      ".integration-flow-row",
      ".demo-flow-row",
      ".capability-index",
      ".resource-note-index",
      ".contact-path-primary",
      ".demo-decision-copy",
      ".demo-decision-badge",
      ".pricing-model-item",
      ".public-cta-card",
    ]) {
      expect(marketingPagesCss).toContain(selector);
    }

    expect(publicSiteCss).toContain(".public-status-supported");
  });
});
