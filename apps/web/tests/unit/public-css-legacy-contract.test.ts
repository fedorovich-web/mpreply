import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const marketingPagesCss = readFileSync(join(root, "styles/marketing-pages.css"), "utf8");
const publicSiteCss = readFileSync(join(root, "styles/public-site.css"), "utf8");
const homepageApprovedCss = readFileSync(join(root, "styles/homepage-approved.css"), "utf8");

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

  it("does not keep the superseded generic hero and card scaffold", () => {
    const legacySelectors = [
      ".public-hero {",
      ".public-hero-compact",
      ".public-hero-grid",
      ".public-hero-copy",
      ".public-hero-copy-centered",
      ".public-trust-row",
      ".feature-grid",
      ".marketplace-card-grid",
      ".pricing-grid",
      ".resource-grid",
      ".feature-card",
      ".marketplace-card",
      ".pricing-card",
      ".resource-card",
      ".public-note-card",
      ".feature-title",
      ".feature-number",
      ".section-action",
      ".marketplace-card-topline",
      ".marketplace-logo-text",
      ".pricing-state",
      ".resource-state",
    ];

    for (const selector of legacySelectors) {
      expect(publicSiteCss).not.toContain(selector);
    }
  });

  it("does not keep superseded generic panels, FAQ or legal scaffolds", () => {
    const legacySelectors = [
      ".decision-stack",
      ".demo-timeline",
      ".faq-list",
      ".faq-item",
      ".faq-item-icon",
      ".demo-step",
      ".legal-document",
      ".contact-email",
      ".decision-preview",
      ".readiness-summary",
      ".adapter-principles",
      ".adapter-principle",
      ".integration-status-panel",
      ".integration-checklist",
      ".pricing-principle-panel",
      ".resource-intro-panel",
      ".contact-channel-panel",
      ".demo-scenario-card",
      ".demo-scenario-topline",
    ];

    for (const selector of legacySelectors) {
      expect(publicSiteCss).not.toContain(selector);
    }
  });

  it("does not keep descendant selectors for markup that current routes no longer render", () => {
    for (const selector of [
      ".marketplace-monogram-large",
      ".resource-note h2",
      ".resource-note blockquote",
      ".contact-path h2",
      ".public-mobile-menu {",
      ".public-brand small",
      ".public-header-actions .button-ghost",
      ".public-header-actions .button {",
      ".button-ghost {",
      ".button-ghost:hover",
      ".public-nav a[aria-current='page']::after",
      ".public-footer-logo .public-brand-mark",
    ]) {
      expect(publicSiteCss).not.toContain(selector);
    }
  });

  it("keeps shared header breakpoint ownership out of homepage styles", () => {
    expect(publicSiteCss).toMatch(
      /@media \(max-width: 1040px\)[\s\S]*?\.public-header-inner\s*\{[^}]*grid-template-columns:\s*1fr auto;[^}]*\}[\s\S]*?\.public-nav,\s*\.public-header-actions\s*\{[^}]*display:\s*none;[^}]*\}[\s\S]*?\.public-mobile-navigation\s*\{[^}]*display:\s*block;/,
    );
    expect(homepageApprovedCss).not.toMatch(
      /@media \(max-width: 760px\)[\s\S]*?\.public-root \.public-nav,[\s\S]*?\.public-root \.public-header-actions\s*\{[^}]*display:\s*none;/,
    );
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

    for (const selector of [
      ".public-status-supported",
      ".public-subhero",
      ".section-heading",
      ".public-two-column",
      ".public-cta-card",
      ".legal-hero",
      ".legal-warning",
      ".marketplace-readiness-row",
      ".integration-flow-row",
      ".demo-flow-row",
      ".pricing-model-grid",
      ".resource-note",
      ".contact-path",
    ]) {
      expect(publicSiteCss).toContain(selector);
    }
  });
});
