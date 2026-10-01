"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ApiError, apiRequest, buildApiQuery } from "../../lib/api/client";
import { billingCatalogSchema, billingOrderSchema } from "../../lib/api/schemas";
import type { Locale } from "../../lib/i18n";
import { useWorkspace } from "../workspace/WorkspaceProvider";

const purchaseSchema = z.object({ kind: z.enum(["plan", "addon"]), plan_code: z.string().nullable(), months: z.number().int().nullable(),
  packs: z.array(z.object({ quantity: z.number().int().positive(), count: z.number().int().positive() })) });
const storedSchema = z.object({ key: z.string().uuid(), orderId: z.string().uuid().nullable(), purchase: purchaseSchema });
function readStored(key: string): z.infer<typeof storedSchema> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const result = storedSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch { return null; }
}
type Purchase = z.infer<typeof purchaseSchema>;
type Catalog = z.infer<typeof billingCatalogSchema>;
const planNames: Record<Locale, Record<string, string>> = { ru: { start: "Старт", team: "Команда", business: "Бизнес" }, en: { start: "Start", team: "Team", business: "Business" } };
export function billingMoney(minor: number, locale: Locale) { return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(minor / 100); }

export function BillingCheckout() {
  const { activeOrganization, locale, user } = useWorkspace();
  const query = useQuery({ queryKey: ["billing", "catalog", activeOrganization.id], queryFn: () => apiRequest(buildApiQuery("/api/billing/catalog", { organization_id: activeOrganization.id }), billingCatalogSchema), retry: false });
  const ru = locale === "ru";
  if (query.isPending) return <p role="status">{ru ? "Проверяем доступность оплаты…" : "Checking payment availability…"}</p>;
  if (query.error) return <p role="alert">{ru ? "Не удалось получить условия оплаты." : "Could not load payment options."} <button type="button" className="button button-secondary" onClick={() => void query.refetch()}>{ru ? "Повторить" : "Retry"}</button></p>;
  if (!query.data?.enabled) return <p>{ru ? "Оплата пока недоступна." : "Payments are currently unavailable."}</p>;
  if (user.status === "demo") return <p>{ru ? "В демо нельзя оплачивать тариф." : "Payments are unavailable in the demo."}</p>;
  if (!query.data.can_purchase || !["owner", "admin"].includes(activeOrganization.current_user_role)) return <p>{ru ? "Оплачивать тариф может владелец или администратор." : "Only the owner or an administrator can purchase."}</p>;
  return <CheckoutForm key={`${user.id}:${activeOrganization.id}`} catalog={query.data} organizationId={activeOrganization.id} userId={user.id} locale={locale} />;
}

function CheckoutForm({ catalog, organizationId, userId, locale }: { catalog: Catalog; organizationId: string; userId: string; locale: Locale }) {
  const ru = locale === "ru";
  const cache = useQueryClient();
  const storageKey = `mpreply.billing.purchase.${userId}.${organizationId}`;
  const [saved] = useState(() => readStored(storageKey));
  const [started] = useState(() => Date.now());
  const [purchase, setPurchase] = useState<Purchase>(saved?.purchase ?? { kind: "plan", plan_code: catalog.plans[0]?.code ?? "start", months: 1, packs: [] });
  const [orderId, setOrderId] = useState<string | null>(saved?.orderId ?? null);
  const [locked, setLocked] = useState(Boolean(saved));
  const key = useRef<string | null>(saved?.key ?? null);
  const pollingStarted = useRef(started);
  const save = (order: string | null) => {
    try { localStorage.setItem(storageKey, JSON.stringify({ key: key.current, orderId: order, purchase })); }
    catch { /* The current tab still retains its key if browser storage is unavailable. */ }
  };
  const create = useMutation({
    mutationFn: () => {
      key.current ??= crypto.randomUUID(); setLocked(true); save(orderId);
      return apiRequest("/api/billing/orders", billingOrderSchema, { method: "POST", body: { organization_id: organizationId, idempotency_key: key.current, ...purchase } });
    },
    onSuccess: (order) => { setOrderId(order.id); save(order.id); pollingStarted.current = Date.now(); },
    onError: (error) => {
      if (!(error instanceof ApiError) || !error.orderNotCreated) return;
      key.current = null; setLocked(false);
      try { localStorage.removeItem(storageKey); } catch { /* The in-memory key was cleared after explicit server proof. */ }
    },
  });
  const status = useQuery({ queryKey: ["billing", "order", organizationId, orderId], enabled: orderId !== null,
    queryFn: () => apiRequest(buildApiQuery(`/api/billing/orders/${orderId}`, { organization_id: organizationId }), billingOrderSchema), retry: false,
    refetchInterval: (query) => query.state.error || ["paid", "failed"].includes(query.state.data?.state ?? "") || Date.now() - pollingStarted.current > 300000 ? false : 5000 });
  const order = status.data ?? create.data;
  const paid = order?.state === "paid";
  useEffect(() => {
    if (!paid) return;
    void cache.invalidateQueries({ queryKey: ["billing", "overview", organizationId] });
    void cache.invalidateQueries({ queryKey: ["billing", "orders", organizationId] });
  }, [paid, cache, organizationId]);
  const selectedPlan = catalog.plans.find((plan) => plan.code === purchase.plan_code);
  const amount = purchase.kind === "plan" ? (purchase.months === 12 ? selectedPlan?.amount_year_minor : selectedPlan?.amount_month_minor) ?? 0
    : purchase.packs.reduce((sum, row) => sum + (catalog.packs.find((pack) => pack.quantity === row.quantity)?.amount_minor ?? 0) * row.count, 0);
  const nextPurchase = () => { key.current = null; setLocked(false); setOrderId(null); create.reset(); try { localStorage.removeItem(storageKey); } catch { /* No automatic purchase follows storage errors. */ } };
  return <section className="billing-section" aria-labelledby="billing-checkout-title">
    <h2 id="billing-checkout-title">{ru ? "Оплата тарифа и ответов" : "Buy a plan or replies"}</h2>
    <p>{ru ? "Каждая покупка оплачивается вручную. Автосписаний нет. Другой тариф начнёт действовать после текущего оплаченного периода." : "Each purchase is paid manually, without automatic charges. A different plan starts after your current paid period."}</p>
    <form className="billing-checkout-form" onSubmit={(event) => { event.preventDefault(); if (!create.isPending && !orderId) create.mutate(); }}>
      <fieldset disabled={locked || create.isPending}>
        <legend>{ru ? "Что оплачиваем" : "Purchase"}</legend>
        <label>{ru ? "Покупка" : "Type"}<select value={purchase.kind} onChange={(event) => setPurchase(event.target.value === "plan"
          ? { kind: "plan", plan_code: catalog.plans[0]?.code ?? "start", months: 1, packs: [] }
          : { kind: "addon", plan_code: null, months: null, packs: [{ quantity: catalog.packs[0]?.quantity ?? 50, count: 1 }] })}>
          <option value="plan">{ru ? "Тариф" : "Plan"}</option><option value="addon">{ru ? "Дополнительные ответы" : "Extra replies"}</option>
        </select></label>
        {purchase.kind === "plan" ? <>
          <label>{ru ? "Тариф" : "Plan"}<select value={purchase.plan_code ?? ""} onChange={(event) => setPurchase({ ...purchase, plan_code: event.target.value })}>{catalog.plans.map((plan) => <option key={plan.code} value={plan.code}>{planNames[locale][plan.code] ?? plan.code}</option>)}</select></label>
          <label>{ru ? "Период" : "Period"}<select value={purchase.months ?? 1} onChange={(event) => setPurchase({ ...purchase, months: Number(event.target.value) })}><option value={1}>{ru ? "Месяц" : "Month"}</option><option value={12}>{ru ? "Год, −20%" : "Year, −20%"}</option></select></label>
          <p>{ru ? `Ответы начисляются помесячно: ${selectedPlan?.monthly_credits ?? 0}.` : `${selectedPlan?.monthly_credits ?? 0} replies are granted each month.`}</p>
        </> : <>
          {purchase.packs.map((row, index) => <div className="billing-pack-row" key={index}>
            <label>{ru ? `Пакет ${index + 1}` : `Pack ${index + 1}`}<select value={row.quantity} onChange={(event) => setPurchase({ ...purchase, packs: purchase.packs.map((pack, i) => i === index ? { ...pack, quantity: Number(event.target.value) } : pack) })}>{catalog.packs.map((pack) => <option key={pack.quantity} value={pack.quantity}>{pack.quantity} — {billingMoney(pack.amount_minor, locale)}</option>)}</select></label>
            <label>{ru ? `Количество пакетов ${index + 1}` : `Pack count ${index + 1}`}<input type="number" min={1} max={100} required value={row.count} onChange={(event) => setPurchase({ ...purchase, packs: purchase.packs.map((pack, i) => i === index ? { ...pack, count: Number(event.target.value) } : pack) })} /></label>
            {purchase.packs.length > 1 ? <button type="button" className="button button-secondary" onClick={() => setPurchase({ ...purchase, packs: purchase.packs.filter((_, i) => i !== index) })}>{ru ? `Удалить пакет ${index + 1}` : `Remove pack ${index + 1}`}</button> : null}
          </div>)}
          <button type="button" className="button button-secondary" disabled={purchase.packs.length >= 32} onClick={() => setPurchase({ ...purchase, packs: [...purchase.packs, { quantity: catalog.packs[0]?.quantity ?? 50, count: 1 }] })}>{ru ? "Добавить пакет" : "Add a pack"}</button>
          <p>{ru ? "Ответы сохраняются без срока. Для использования нужен действующий оплаченный тариф." : "Replies do not expire. An active paid plan is required to use them."}</p>
        </>}
      </fieldset>
      <p><strong>{ru ? "К оплате: " : "Total: "}{billingMoney(order?.amount_minor ?? amount, locale)}</strong></p>
      {!orderId ? <button className="button button-primary" disabled={create.isPending || amount <= 0} type="submit">{create.isPending ? (ru ? "Готовим оплату…" : "Preparing payment…") : create.error ? (ru ? "Проверить платёж" : "Check payment") : (ru ? "Подготовить оплату" : "Prepare payment")}</button> : null}
    </form>
    {order?.state === "review_required" ? <p role="status">{ru ? "Проверяем создание платежа. Повторная оплата пока недоступна." : "Checking payment creation. A duplicate payment is unavailable."}</p>
      : paid ? <p role="status">{ru ? "Оплата подтверждена. Тариф или ответы начислены." : "Payment confirmed. Your plan or replies have been credited."}</p>
        : order?.state === "failed" ? <p role="alert">{ru ? "Оплата не прошла." : "Payment failed."}</p>
          : order ? <p role="status">{ru ? "Ожидаем подтверждения оплаты." : "Waiting for payment confirmation."}</p> : null}
    {order?.payment_url && order.state === "pending" ? <a className="button button-primary" href={order.payment_url} rel="noreferrer">{ru ? "Продолжить оплату в Lava" : "Continue payment with Lava"}</a> : null}
    {orderId && !paid ? <button className="button button-secondary" type="button" onClick={() => { pollingStarted.current = Date.now(); void status.refetch(); }}>{ru ? "Обновить статус" : "Refresh status"}</button> : null}
    {paid || order?.state === "failed" ? <button className="button button-secondary" type="button" onClick={nextPurchase}>{ru ? "Новая покупка" : "New purchase"}</button> : null}
    {create.error || status.error ? <p role="alert">{create.error instanceof ApiError && create.error.orderNotCreated
      ? (ru ? "Покупка не создана. Измените состав покупки и повторите попытку." : "No purchase was created. Adjust your purchase and try again.")
      : (ru ? "Не удалось получить результат. Повторите проверку — новый платёж не создаётся." : "Could not get the result. Check again; no new payment is created.")}</p> : null}
    {order?.state === "review_required" ? <a href="mailto:support@mpreply.ru">{ru ? "Написать в поддержку" : "Contact support"}</a> : null}
  </section>;
}
