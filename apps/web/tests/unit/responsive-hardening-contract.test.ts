import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const shell = readFileSync(join(root, "styles/dashboard-shell-approved.css"), "utf8");
const ai = readFileSync(join(root, "styles/dashboard-ai-assistant-approved.css"), "utf8");
const fidelity = readFileSync(join(root, "styles/dashboard-final-fidelity.css"), "utf8");

describe("authenticated responsive hardening", () => {
  it("keeps mobile topbar controls within the available width", () => {
    expect(shell).toContain("@media (max-width: 640px)");
    expect(shell).toContain(".app-topbar-user {\n\t\tdisplay: none;");
    expect(shell).toContain(".app-topbar-controls {\n\t\tflex: 0 0 auto;");
    expect(shell).toContain("overflow-wrap: anywhere;");
  });

  it("switches the three-column AI workspace before the sidebar makes it overflow", () => {
    expect(ai).toContain("@media (min-width: 1281px)");
    expect(ai).toContain("@media (max-width: 1280px)");
    expect(ai).not.toContain("@media (min-width: 1181px)");
  });

  it("stacks fixed-minimum review and integration workspaces before they exceed the content column", () => {
    expect(fidelity).toContain("@media (max-width: 1180px)");
    expect(fidelity).toContain(".review-queue-workspace,\n\t.wildberries-layout");
    expect(fidelity).toContain("grid-template-columns: 1fr;");
  });
});
