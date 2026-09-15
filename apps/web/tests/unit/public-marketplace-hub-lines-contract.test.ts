import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const marketplaces = readFileSync(join(root, "app/marketplaces/page.tsx"), "utf8");
const finalCss = readFileSync(join(root, "styles/public-mockup-final-details.css"), "utf8");

describe("marketplace hero hub connectors", () => {
  it("renders the two crossing paths as four dashed connector arms around the center hub", () => {
    expect(marketplaces).toContain("marketplace-hub-line l1");
    expect(marketplaces).toContain("marketplace-hub-line l2");
    expect(finalCss).toContain(".marketplace-hub-line");
    expect(finalCss).toContain("border-top: 2px dashed");
    expect(finalCss).toContain("background: none");
  });
});
