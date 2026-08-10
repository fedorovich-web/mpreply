import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import expandDefault, {
  EXPANSION_MAX_LENGTH,
  expand,
} from "brace-expansion";

const require = createRequire(import.meta.url);

describe("vendored brace-expansion security contract", () => {
  it("supports both legacy CommonJS and modern named exports", () => {
    const legacyExpand = require("brace-expansion") as typeof expand;

    expect(legacyExpand).toBe(expand);
    expect(expandDefault).toBe(expand);
    expect(expand("file-{a,b,c}.jpg")).toEqual([
      "file-a.jpg",
      "file-b.jpg",
      "file-c.jpg",
    ]);
  });

  it("bounds total expansion length for the CVE-2026-14257 input class", () => {
    const maxLength = 4_000;
    const output = expand("{a,b}".repeat(1_500), { maxLength });
    const totalLength = output.reduce((total, value) => total + value.length, 0);

    expect(EXPANSION_MAX_LENGTH).toBe(4_000_000);
    expect(totalLength).toBeLessThanOrEqual(maxLength);
  });
});
