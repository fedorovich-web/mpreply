import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "styles/marketplace-detail-approved.css"), "utf8");

describe("marketplace detail approved stylesheet", () => {
  it("sizes only the decorative review icon, not the review copy wrapper", () => {
    expect(css).toContain(".marketplace-detail-review > span[aria-hidden='true']");
    expect(css).not.toContain(".marketplace-detail-review > span {");
  });
});
