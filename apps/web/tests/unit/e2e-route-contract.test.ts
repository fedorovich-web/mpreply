import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { aiDraftHistoryRoutePattern } from "../../e2e/helpers/ai-assistant-api";
import { marketplaces, publicRoutes, siteConfig } from "../../lib/site-config";

const appRoot = join(process.cwd(), "app");
const dashboardRoutes = [
  "/app/dashboard",
  "/app/inbox",
  "/app/review-queue",
  "/app/ai-assistant",
  "/app/automation-rules",
  "/app/integrations",
  "/app/analytics",
  "/app/billing",
  "/app/admin",
] as const;

function routePageExists(route: string): boolean {
  if (route === "/") return existsSync(join(appRoot, "page.tsx"));
  return existsSync(join(appRoot, ...route.slice(1).split("/"), "page.tsx"));
}

describe("route contracts", () => {
  it("matches AI draft history requests but never shadows the generation endpoint", () => {
    expect(aiDraftHistoryRoutePattern.test("http://localhost:3000/api/ai/drafts?organization_id=org-1")).toBe(true);
    expect(aiDraftHistoryRoutePattern.test("http://localhost:3000/api/ai/drafts")).toBe(true);
    expect(aiDraftHistoryRoutePattern.test("http://localhost:3000/api/ai/drafts/generate")).toBe(false);
  });

  it("keeps every configured public route backed by a real App Router page", () => {
    for (const route of publicRoutes) {
      expect(routePageExists(route), `Missing page.tsx for public route ${route}`).toBe(true);
    }
  });

  it("keeps primary navigation and marketplace links inside the configured public route set", () => {
    const configuredRoutes = new Set<string>(publicRoutes);
    for (const item of siteConfig.navigation) expect(configuredRoutes.has(item.href)).toBe(true);
    for (const marketplace of marketplaces) expect(configuredRoutes.has(marketplace.path)).toBe(true);
  });

  it("keeps every dashboard navigation target backed by a real App Router page", () => {
    for (const route of dashboardRoutes) {
      expect(routePageExists(route), `Missing page.tsx for dashboard route ${route}`).toBe(true);
    }
  });
});
