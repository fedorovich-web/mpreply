import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "styles/marketplaces-approved.css"), "utf8");

describe("marketplaces approved stylesheet", () => {
  it("targets the first feed row after the feed header instead of an impossible first-of-type", () => {
    expect(css).toContain(".marketplace-unified-feed-head + .marketplace-unified-row");
    expect(css).not.toContain(".marketplace-unified-row:first-of-type");
  });
});
