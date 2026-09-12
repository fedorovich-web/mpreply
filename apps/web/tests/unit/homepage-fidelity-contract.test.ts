import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const fidelityCss = readFileSync(join(process.cwd(), "styles/homepage-fidelity.css"), "utf8");

describe("homepage fidelity overrides", () => {
  it("avoids dead hero selectors and specificity hacks", () => {
    expect(fidelityCss).not.toContain("homepage-window-time");
    expect(fidelityCss).not.toContain("!important");
    expect(fidelityCss).not.toContain("min-height: 32.5rem");
    expect(fidelityCss).toContain(".public-root .homepage-models-section");
    expect(fidelityCss).toContain(".public-root .homepage-approved-process");
  });
});
