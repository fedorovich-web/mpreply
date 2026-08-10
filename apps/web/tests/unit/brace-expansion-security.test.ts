import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

describe("brace-expansion security compatibility", () => {
  it("preserves the callable CommonJS contract used by minimatch 3", () => {
    const expand = require("brace-expansion") as ((value: string) => string[]) & {
      expand: (value: string) => string[];
    };

    expect(typeof expand).toBe("function");
    expect(expand("{a,b}")).toEqual(["a", "b"]);
    expect(expand.expand("file-{01..03}")).toEqual([
      "file-01",
      "file-02",
      "file-03",
    ]);
  });

  it("exposes the named export used by current minimatch", async () => {
    const module = await import("brace-expansion");
    expect(typeof module.expand).toBe("function");
    expect(module.expand("{x,y}")).toEqual(["x", "y"]);
  });

  it("bounds aggregate output length for chained brace groups", () => {
    const expand = require("brace-expansion") as (
      value: string,
      options?: { max?: number; maxLength?: number },
    ) => string[];

    const result = expand("{a,b}".repeat(1500), {
      max: 100_000,
      maxLength: 2_000,
    });
    const totalLength = result.reduce((sum, item) => sum + item.length, 0);

    expect(totalLength).toBeLessThanOrEqual(2_000);
  });
});
