import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const tokens = readFileSync(join(root, "styles/tokens.css"), "utf8");
const brandTheme = readFileSync(join(root, "styles/brand-theme.css"), "utf8");
const marketing = readFileSync(join(root, "styles/marketing-site.css"), "utf8");

describe("design token cleanup", () => {
  it("does not retain tokens for removed canvas, signal-flow or theme-toggle UI", () => {
    const sources = `${tokens}\n${brandTheme}\n${marketing}`;
    for (const retiredToken of [
      "--canvas-",
      "--gradient-signal-track",
      "--shadow-signal-step",
      "--size-theme-toggle",
      "--size-theme-track",
      "--size-theme-thumb",
      "--transform-theme-thumb",
      "--transform-theme-icon",
      "--size-signal-marker",
      "--size-signal-track",
      "--opacity-signal-track",
    ]) {
      expect(sources).not.toContain(retiredToken);
    }
  });
});
