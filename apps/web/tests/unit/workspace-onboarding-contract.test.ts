import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const provider = readFileSync(join(root, "components/workspace/WorkspaceProvider.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const styles = readFileSync(join(root, "styles/workspace-onboarding-approved.css"), "utf8");

describe("first workspace onboarding", () => {
  it("keeps organization creation on the existing live API and continues to integrations", () => {
    expect(provider).toContain('apiRequest("/api/organizations"');
    expect(provider).toContain('router.replace("/app/integrations")');
  });

  it("sets the correct product expectation before the first marketplace connection", () => {
    expect(provider).toContain("MPReply");
    expect(provider).toContain("4 готовые интеграции");
    expect(provider).toContain("Wildberries");
    expect(provider).toContain("Ozon");
    expect(provider).toContain("Яндекс Маркет");
    expect(provider).toContain("Авито");
  });

  it("uses the canonical MPReply brand mark instead of a separate onboarding glyph", () => {
    expect(provider).toContain('import { PublicBrandMark } from "../public-site/PublicBrandMark"');
    expect(provider).toContain("<PublicBrandMark />");
    expect(provider).not.toContain("workspace-onboarding-mark");
    expect(styles).not.toContain(".workspace-onboarding-mark");
  });

  it("uses MPReply workspace storage with a fail-safe Respio migration", () => {
    expect(provider).toContain('const ACTIVE_ORGANIZATION_KEY = "mpreply.activeOrganizationId"');
    expect(provider).toContain('const LEGACY_ACTIVE_ORGANIZATION_KEY = "respio.activeOrganizationId"');
    expect(provider).toContain("readStoredActiveOrganizationId");
    expect(provider).toContain("storeActiveOrganizationId");
    expect(provider).toContain("clearStoredActiveOrganizationId");
    expect(provider).toContain("catch {");
  });

  it("uses a scoped responsive onboarding layer without a second palette", () => {
    expect(layout).toContain('import "../styles/workspace-onboarding-approved.css"');
    expect(styles).toContain(".workspace-onboarding-page");
    expect(styles).toContain(".workspace-onboarding-brand");
    expect(styles).toContain(".workspace-onboarding-marketplaces");
    expect(styles).toContain("@media (max-width: 520px)");
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
