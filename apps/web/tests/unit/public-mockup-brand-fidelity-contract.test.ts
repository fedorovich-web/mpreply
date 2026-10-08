import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const brandFidelity = readFileSync(join(root, "styles/public-mockup-brand-fidelity.css"), "utf8");

describe("public mockup brand fidelity contract", () => {
  it("contains the canonical blue MPReply palette", () => {
    for (const value of [
      "#0b68f6",
      "#0757d7",
      "#eaf4ff",
      "#0d6cf7",
      "#0674ff",
      "#0a5fe8",
    ]) {
      expect(brandFidelity.toLowerCase()).toContain(value);
    }
  });

  it("does not retain the legacy violet MPReply palette", () => {
    for (const value of [
      "#5148e8",
      "#443bcf",
      "#3d35c0",
      "#635bff",
      "#5964ff",
      "#f0efff",
      "#f3f0ff",
      "#f7f6ff",
      "#fbfaff",
      "#f1efff",
      "#fdfcff",
      "#f2f0ff",
      "#faf9ff",
      "#f3f1ff",
      "#f5f3ff",
      "#e2dfff",
      "#efedff",
    ]) {
      expect(brandFidelity.toLowerCase()).not.toContain(value);
    }
  });

  it("keeps this layer scoped to public mockup pages", () => {
    expect(brandFidelity).toContain(".public-root:has(.mockup-page)");
    expect(brandFidelity).not.toContain(".app-shell");
    expect(brandFidelity).not.toContain(".dashboard-shell");
  });
});
