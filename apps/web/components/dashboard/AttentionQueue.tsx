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
  if (query.isPending) return <section className="attention-panel"><h2>Проверяем рабочую очередь</h2><p>Собираем задачи, требующие вашего решения.</p></section>;
  if (query.error) return <section className="attention-panel is-error" role="alert"><h2>Не удалось загрузить задачи</h2><p>{query.error instanceof Error ? query.error.message : "Неизвестная ошибка"}</p><button className="button button-secondary" onClick={() => void query.refetch()} type="button">Повторить</button></section>;
  if (query.data.items.length === 0 && query.data.integration_issues === 0) return <section className="attention-panel is-clear"><p className="eyebrow">Сейчас</p><h2>Срочных задач нет</h2><p>Новые обращения и ошибки подключений появятся здесь автоматически.</p></section>;
  return <section className="attention-panel"><header><div><p className="eyebrow">Требует внимания</p><h2>Следующие действия</h2></div></header><div className="attention-list">{query.data.items.map((item) => <Link className={`attention-row is-${item.severity}`} href={item.href} key={item.key}><span>{item.title}</span><strong>{item.count}</strong></Link>)}{query.data.integration_issues > 0 ? <Link className="attention-row is-warning" href="/app/integrations"><span>Проверить подключения</span><strong>{query.data.integration_issues}</strong></Link> : null}</div></section>;
}
