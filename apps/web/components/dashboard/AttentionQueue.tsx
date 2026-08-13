"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { apiRequest, buildApiQuery } from "../../lib/api/client";
import { dashboardAttentionSchema } from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";

export function AttentionQueue() {
  const { activeOrganization } = useWorkspace();
  const query = useQuery({
    queryKey: ["dashboard-attention", activeOrganization.id],
    queryFn: () => apiRequest(buildApiQuery("/api/dashboard/attention", { organization_id: activeOrganization.id }), dashboardAttentionSchema),
  });
  if (query.isPending) return <section className="dashboard-action-hub" aria-labelledby="dashboard-actions-title"><header><h2 id="dashboard-actions-title">Нужно сделать</h2><p>Проверяем ответы и подключения, которые требуют решения.</p></header></section>;
  if (query.error) return <section className="dashboard-action-hub is-error" role="alert"><header><h2>Не удалось загрузить задачи</h2><p>{query.error instanceof Error ? query.error.message : "Неизвестная ошибка"}</p></header><button className="button button-secondary" onClick={() => void query.refetch()} type="button">Повторить</button></section>;
  if (query.data.items.length === 0 && query.data.integration_issues === 0) return <section className="dashboard-action-hub is-clear" aria-labelledby="dashboard-actions-title"><header><h2 id="dashboard-actions-title">Нужно сделать</h2><p>Сейчас ничего не требует вашего решения</p></header></section>;
  return <section className="dashboard-action-hub" aria-labelledby="dashboard-actions-title"><header><h2 id="dashboard-actions-title">Нужно сделать</h2><p>Ответы и подключения, которые требуют решения.</p></header><div className="dashboard-action-list">{query.data.items.map((item) => <Link className={`dashboard-action-row is-${item.severity}`} href={item.href} key={item.key}><span>{item.title}</span><strong>{item.count}</strong></Link>)}{query.data.integration_issues > 0 ? <Link className="dashboard-action-row is-warning" href="/app/integrations"><span>Проверить подключения</span><strong>{query.data.integration_issues}</strong></Link> : null}</div></section>;
}
