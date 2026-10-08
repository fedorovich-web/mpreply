import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const privateLayouts = [
  "app/app/layout.tsx",
  "app/en/app/layout.tsx",
  "app/auth/layout.tsx",
  "app/en/auth/layout.tsx",
] as const;

describe("private metadata isolation", () => {
  it("keeps private and auth trees noindex", () => {
    for (const path of privateLayouts) {
      const source = readFileSync(join(root, path), "utf8");
      expect(source, path).toContain("index: false");
      expect(source, path).toContain("follow: false");
      expect(source, path).toContain("nocache: true");
    }
  });

  it("clears inherited public canonical and social metadata", () => {
    for (const path of privateLayouts) {
      const source = readFileSync(join(root, path), "utf8");
      expect(source, path).toContain("description: null");
      expect(source, path).toContain("alternates: null");
      expect(source, path).toContain("openGraph: null");
      expect(source, path).toContain("twitter: null");
    }
  });
});
