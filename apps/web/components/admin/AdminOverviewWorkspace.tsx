"use client";

import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "../../lib/api/client";
import { adminOverviewSchema } from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";

export function AdminOverviewWorkspace() {
  const { user } = useWorkspace();
  const overviewQuery = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => apiRequest("/api/admin/overview", adminOverviewSchema),
    enabled: user.is_superadmin,
  });

  if (!user.is_superadmin) return <div className="workspace-inline-state workspace-inline-state-error"><strong>Доступ запрещён</strong><p>Этот раздел доступен только внутреннему superadmin MPReply.</p></div>;
  if (overviewQuery.isLoading) return <div className="workspace-inline-state"><strong>Загружаем admin overview</strong><p>Считаем системные показатели.</p></div>;
  if (overviewQuery.error || !overviewQuery.data) return <div className="workspace-inline-state workspace-inline-state-error"><strong>Не удалось загрузить admin overview</strong><p>{overviewQuery.error instanceof Error ? overviewQuery.error.message : "Нет данных"}</p></div>;

  const data = overviewQuery.data;
  const metrics = [
    ["Организации", data.organizations_total, `${data.organizations_active} active`],
    ["Пользователи", data.users_total, "Все зарегистрированные аккаунты"],
    ["Активные подписки", data.subscriptions_active, "active + trialing"],
    ["Usage events · 30 дней", data.usage_events_30d, "Системный usage ledger"],
    ["AI cost · 30 дней", formatUsd(data.ai_cost_estimate_30d), "Оценка по сохранённым AI drafts"],
    ["Integration failures · 24ч", data.integration_failures_24h, `${data.replies_failed_24h} failed replies`],
  ] as const;

  return <section className="admin-overview-grid">{metrics.map(([label, value, helper]) => <article className="analytics-metric" key={label}><span>{label}</span><strong>{typeof value === "number" ? new Intl.NumberFormat("ru-RU").format(value) : value}</strong><p>{helper}</p></article>)}</section>;
}

function formatUsd(value: number): string { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(value); }
