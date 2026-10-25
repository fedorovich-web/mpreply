import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readStyle = (path: string) => readFileSync(join(root, "styles", path), "utf8").replace(/\r\n/g, "\n");
const shell = readStyle("dashboard-shell-approved.css");
const ai = readStyle("dashboard-ai-assistant-approved.css");
const fidelity = readStyle("dashboard-final-fidelity.css");

describe("authenticated responsive hardening", () => {
  it("keeps mobile topbar controls within the available width", () => {
    expect(shell).toContain("@media (max-width: 640px)");
    expect(shell).toContain(".app-topbar-user {\n\t\tdisplay: none;");
    expect(shell).toContain(".app-topbar-controls {\n\t\tflex: 0 0 auto;");
    expect(shell).toContain("overflow-wrap: anywhere;");
  });

  it("switches the three-column AI workspace before the sidebar makes it overflow", () => {
    expect(ai).toContain("@media (min-width: 1441px)");
    expect(ai).toContain("@media (max-width: 1440px)");
    expect(ai).not.toContain("@media (min-width: 1181px)");
  });

  it("stacks fixed-minimum review and integration workspaces before they exceed the content column", () => {
    expect(fidelity).toContain("@media (max-width: 1180px)");
    expect(fidelity).toContain(".review-queue-workspace,\n\t.wildberries-layout");
    expect(fidelity).toContain("grid-template-columns: 1fr;");
  });
});
