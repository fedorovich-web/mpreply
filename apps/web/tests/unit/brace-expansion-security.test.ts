import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import expandDefault, {
  EXPANSION_MAX_LENGTH,
  expand,
} from "brace-expansion";

const require = createRequire(import.meta.url);

function runIsolatedProbe(source: string, timeout: number) {
  return spawnSync(
    process.execPath,
    ["--max-old-space-size=64", "-e", source],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout,
    },
  );
}

describe("vendored brace-expansion security contract", () => {
  it("supports legacy CommonJS and modern named/default imports", () => {
    const legacyExpand = require("brace-expansion") as typeof expand;
    const expected = ["file-a.jpg", "file-b.jpg", "file-c.jpg"];

    expect(typeof legacyExpand).toBe("function");
    expect(legacyExpand("file-{a,b,c}.jpg")).toEqual(expected);
    expect(expandDefault("file-{a,b,c}.jpg")).toEqual(expected);
    expect(expand("file-{a,b,c}.jpg")).toEqual(expected);
  });

  it("bounds total expansion length for the CVE-2026-14257 input class", () => {
    const maxLength = 4_000;
    const output = expand("{a,b}".repeat(1_500), { maxLength });
    const totalLength = output.reduce((total, value) => total + value.length, 0);

    expect(EXPANSION_MAX_LENGTH).toBe(4_000_000);
    expect(totalLength).toBeLessThanOrEqual(maxLength);
  });

  it(
    "bounds intermediate comma-alternative arrays for CVE-2026-69152",
    () => {
      const source = String.raw`
        const { expand } = require("brace-expansion");
        const part = "{" + "0".repeat(50) + "1..100000}";
        const input = "{" + Array(400).fill(part).join(",") + "}";
        const output = expand(input);
        const totalLength = output.reduce((total, value) => total + value.length, 0);
        if (totalLength > 4_000_000) process.exit(2);
      `;
      const result = runIsolatedProbe(source, 15_000);

      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).toBe(0);
    },
    20_000,
  );

  it(
    "bounds padded-sequence work before it can stall the event loop",
    () => {
      const source = String.raw`
        const { expand } = require("brace-expansion");
        const input = "{" + "0".repeat(100_000) + "1..100000}";
        const output = expand(input);
        if (output.length === 0) process.exit(2);
        const totalLength = output.reduce((total, value) => total + value.length, 0);
        if (totalLength > 4_000_000) process.exit(3);
      `;
      const result = runIsolatedProbe(source, 5_000);

      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).toBe(0);
    },
    10_000,
  );
});
