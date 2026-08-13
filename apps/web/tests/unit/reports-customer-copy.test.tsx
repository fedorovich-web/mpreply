import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnalyticsWorkspace } from "../../components/analytics/AnalyticsWorkspace";
import { BillingWorkspace } from "../../components/billing/BillingWorkspace";
import { useWorkspace } from "../../components/workspace/WorkspaceProvider";

vi.mock("../../components/workspace/WorkspaceProvider", () => ({ useWorkspace: vi.fn() }));

const organization = { id: "11111111-1111-4111-8111-111111111111", name: "Основной кабинет", slug: "main", owner_user_id: "22222222-2222-4222-8222-222222222222", plan_id: null, default_response_mode: "auto", status: "active", current_user_role: "owner" as const, created_at: "2026-08-13T06:00:00Z", updated_at: "2026-08-13T06:00:00Z" };
const period = { start: "2026-07-15T00:00:00Z", end: "2026-08-13T23:59:59Z", days: 30 };

beforeEach(() => {
  vi.mocked(useWorkspace).mockReturnValue({ user: { id: organization.owner_user_id, email: "owner@example.com", name: "Владелец", status: "active", is_superadmin: false, created_at: organization.created_at, updated_at: organization.updated_at }, organizations: [organization], activeOrganization: organization, setActiveOrganizationId: vi.fn(), logout: vi.fn(async () => undefined), isLoggingOut: false });
});

afterEach(() => vi.unstubAllGlobals());

function renderWorkspace(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe("customer-facing reports", () => {
  it("names analytics sections by business meaning", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("/overview")) return new Response(JSON.stringify({ period, total_messages: 10, new_messages: 2, unanswered_messages: 1, answered_messages: 9, negative_reviews: 1, replies_sent: 9, auto_replies_sent: 7, manual_replies_sent: 2, ai_drafts_generated: 8, average_response_seconds: 120, ai_acceptance_rate: 0.8 }), { status: 200 });
      if (url.includes("/messages")) return new Response(JSON.stringify({ period, points: [] }), { status: 200 });
      if (url.includes("/marketplaces")) return new Response(JSON.stringify({ period, items: [] }), { status: 200 });
      if (url.includes("/products")) return new Response(JSON.stringify({ period, items: [] }), { status: 200 });
      return new Response(JSON.stringify({ period, drafts_generated: 8, tokens_input: 100, tokens_output: 50, cost_estimate: 0.1, average_latency_ms: 400, safety_flagged_drafts: 1, models: [{ model: "verified-model", drafts: 8, tokens_input: 100, tokens_output: 50, cost_estimate: 0.1, average_latency_ms: 400 }] }), { status: 200 });
    }));

    renderWorkspace(<AnalyticsWorkspace />);

    expect(await screen.findByRole("heading", { name: "Обращения и ответы по дням" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Использование ИИ" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "По маркетплейсам" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "По товарам" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "По моделям ИИ" })).toBeInTheDocument();
    for (const forbidden of ["Live analytics", "Volume", "AI cost", "OpenRouter usage", "Channels", "Products", "Models"]) expect(screen.queryByText(forbidden)).not.toBeInTheDocument();
  });

  it("explains tariff limits without internal billing architecture", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ organization_id: organization.id, plan: { id: "44444444-4444-4444-8444-444444444444", code: "pro", name: "Pro", price_month_minor: null, currency: "RUB", limits_json: {}, features_json: {}, is_active: true, is_default: true }, subscription: null, usage_period_start: "2026-08-01T00:00:00Z", usage_period_end: "2026-09-01T00:00:00Z", usage: [], pricing_finalized: false }), { status: 200 })));

    renderWorkspace(<BillingWorkspace />);

    expect(await screen.findByRole("heading", { name: "Текущий тариф" })).toBeInTheDocument();
    expect(screen.getByText("Цена ещё не опубликована")).toBeInTheDocument();
    for (const forbidden of ["Current plan", "Billing-ready", "provider IDs", "usage evaluation", "workspace"]) expect(screen.queryByText(new RegExp(forbidden, "i"))).not.toBeInTheDocument();
  });
});
