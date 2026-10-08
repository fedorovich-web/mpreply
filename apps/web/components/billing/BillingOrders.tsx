"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest, buildApiQuery } from "../../lib/api/client";
import { billingOrdersSchema } from "../../lib/api/schemas";
import type { Locale } from "../../lib/i18n";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { billingMoney } from "./BillingCheckout";

export function BillingOrders() {
  const { activeOrganization, locale } = useWorkspace();
  return <OrderHistory key={activeOrganization.id} organizationId={activeOrganization.id} locale={locale} />;
}

function OrderHistory({ organizationId, locale }: { organizationId: string; locale: Locale }) {
  const ru = locale === "ru";
  const [offset, setOffset] = useState(0);
  const query = useQuery({ queryKey: ["billing", "orders", organizationId, offset], queryFn: () => apiRequest(buildApiQuery("/api/billing/orders", { organization_id: organizationId, limit: 20, offset }), billingOrdersSchema), retry: false });
  const labels: Record<string, string> = ru ? { creating: "Готовится", pending: "Ожидает оплаты", review_required: "Проверяется", paid: "Оплачен", failed: "Не оплачен" }
    : { creating: "Preparing", pending: "Awaiting payment", review_required: "Under review", paid: "Paid", failed: "Not paid" };
  return <section className="billing-section" aria-labelledby="billing-orders-title">
    <div className="billing-section-heading"><h2 id="billing-orders-title">{ru ? "История оплат" : "Payment history"}</h2><button type="button" className="button button-secondary" disabled={query.isFetching} onClick={() => void query.refetch()}>{ru ? "Обновить" : "Refresh"}</button></div>
    {query.isPending ? <p role="status">{ru ? "Загружаем покупки…" : "Loading purchases…"}</p>
      : query.error ? <p role="alert">{ru ? "Не удалось получить историю оплат." : "Could not load payment history."}</p>
        : !query.data?.length ? <p>{ru ? "Покупок пока нет." : "No purchases yet."}</p>
          : <ul className="billing-order-list">{query.data.filter((order) => order.organization_id === organizationId).map((order) => <li key={order.id}>
            <div><strong>{order.kind === "plan" ? (ru ? "Тариф" : "Plan") : (ru ? `${order.addon_credits} ответов` : `${order.addon_credits} replies`)}</strong><p>{new Date(order.created_at).toLocaleDateString(ru ? "ru-RU" : "en-US")} · {billingMoney(order.amount_minor, locale)}</p></div>
            <span>{labels[order.state]}</span>{order.state === "pending" && order.payment_url ? <a className="button button-secondary" href={order.payment_url} rel="noreferrer">{ru ? "Продолжить оплату" : "Continue payment"}</a> : null}
          </li>)}</ul>}
    <div className="billing-history-controls"><button type="button" className="button button-secondary" disabled={offset === 0 || query.isFetching} onClick={() => setOffset(Math.max(0, offset - 20))}>{ru ? "Назад" : "Previous"}</button><button type="button" className="button button-secondary" disabled={query.data?.length !== 20 || query.isFetching || offset >= 10000} onClick={() => setOffset(offset + 20)}>{ru ? "Далее" : "Next"}</button></div>
  </section>;
}
