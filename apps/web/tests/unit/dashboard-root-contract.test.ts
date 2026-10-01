import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const page = readFileSync(join(root, "app/app/page.tsx"), "utf8");

describe("authenticated app root", () => {
  it("routes the bare /app entry to the operational dashboard", () => {
    expect(page).toContain('import { redirect } from "next/navigation"');
    expect(page).toContain('redirect("/app/dashboard")');
  });

  it("does not expose legacy sprint or Respio placeholder content", () => {
    expect(page).not.toContain("Respio workspace");
    expect(page).not.toContain("Sprint 1");
    expect(page).not.toContain("Credentials encryption");
  });
});
