import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getMarketplaceDetailContent } from "../../lib/marketplace-detail-content";

const root = process.cwd();
const detail = readFileSync(join(root, "components/public-site/MarketplaceLanding.tsx"), "utf8");
const icon = readFileSync(join(root, "components/public-site/PublicIcon.tsx"), "utf8");
const css = readFileSync(join(root, "styles/public-approved-raster-icons.css"), "utf8");

describe("shared marketplace detail supplied icons", () => {
  it("selects Wildberries tools and benefits from the content catalog without positional raster substitutions", () => {
    expect(detail).toContain("detailContent.tools.map");
    expect(detail).toContain("detailContent.benefits.map");
    expect(detail).toContain("<PublicIcon name={tool.icon} />");
    expect(detail).toContain("<PublicIcon name={benefit.icon} />");
    const content = getMarketplaceDetailContent("wildberries");
    expect(content.tools.find((tool) => tool.title === "История действий")?.icon).toBe("clock");
    expect(content.benefits.map((benefit) => benefit.icon)).toEqual(["clock", "users", "document", "chart"]);
    for (const asset of ["16-history-clock", "19-team-users", "06-reply-document", "14-analytics-growth"]) expect(icon).toContain("/images/icons/final/" + asset + ".avif");
    expect(css).not.toMatch(/wildberries-icons|nth-child\(|:has\(/);
  });
  it("keeps the same contained 40px detail artwork for every marketplace", () => {
    expect(css).toContain(".mockup-page .detail-tool-card .mockup-icon-chip > .public-icon-image");
    expect(css).toContain(".mockup-page .detail-step-card .mockup-icon-chip > .public-icon-image");
    expect(css).toContain(".mockup-page .detail-benefit-card .mockup-icon-chip > .public-icon-image");
    expect(css).toContain("width: 40px");
    expect(css).toContain("height: 40px");
    expect(css).toContain("background-size: contain");
    expect(css).not.toContain("display: none");
  });
});
