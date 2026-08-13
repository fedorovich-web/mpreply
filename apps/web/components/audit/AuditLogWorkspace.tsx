"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";

import { apiRequest, buildApiQuery } from "../../lib/api/client";
import { auditLogListSchema, type AuditLog } from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";

const actionLabels: Record<string, string> = {
  "organization.created": "Создана организация",
  "organization.updated": "Изменены настройки организации",
  "organization.invitation.created": "Создано приглашение",
  "organization.invitation.revoked": "Отозвано приглашение",
  "organization.invitation.accepted": "Принято приглашение",
  "organization.member.role_updated": "Изменена роль сотрудника",
  "organization.member.removed": "Удалён сотрудник",
  "ai_instruction_set.created": "Создан стиль ответов",
  "ai_instruction_set.updated": "Изменён стиль ответов",
  "ai_instruction_set.default_changed": "Изменён основной стиль ответов",
  "knowledge_entry.created": "Добавлены данные для ответов",
  "knowledge_entry.updated": "Изменены данные для ответов",
  "automation_rule.created": "Создано правило",
  "automation_rule.updated": "Изменено правило",
  "seller_settings.updated": "Изменены настройки ответов",
  "marketplace_account.created": "Подключён кабинет маркетплейса",
  "marketplace_account.updated": "Изменён кабинет маркетплейса",
};

const entityLabels: Record<string, string> = {
  organization: "Организация",
  organization_user: "Сотрудник",
  organization_invitation: "Приглашение",
  ai_instruction_set: "Стиль ответов",
  knowledge_entry: "Данные для ответов",
  automation_rule: "Правило",
  marketplace_account: "Кабинет маркетплейса",
  seller_settings: "Настройки ответов",
};

const sensitiveKey = /token|secret|credential|authorization|prompt|password/i;

export function AuditLogWorkspace() {
  const { activeOrganization } = useWorkspace();
  return <AuditLogContent key={activeOrganization.id} organizationId={activeOrganization.id} role={activeOrganization.current_user_role} />;
}

function AuditLogContent({ organizationId, role }: { organizationId: string; role: "owner" | "admin" | "manager" | "viewer" }) {
  const canRead = role === "owner" || role === "admin";
  const [action, setAction] = useState("");
  const query = useInfiniteQuery({
    queryKey: ["audit-logs", organizationId, action],
    queryFn: ({ pageParam }) => apiRequest(buildApiQuery("/api/audit-logs", { organization_id: organizationId, action: action || null, cursor: pageParam, limit: 50 }), auditLogListSchema),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.has_more ? page.next_cursor : undefined,
    enabled: canRead,
  });

  if (!canRead) return <section className="management-state"><h2>Журнал доступен владельцу и администратору</h2><p>В журнале хранятся изменения настроек, команды, правил и подключений.</p></section>;
  if (query.isPending) return <section className="management-state"><h2>Загружаем журнал</h2><p>Получаем последние действия организации.</p></section>;
  if (query.error) return <section className="management-state is-error" role="alert"><h2>Не удалось загрузить журнал</h2><p>{errorMessage(query.error)}</p><button className="button button-secondary" onClick={() => void query.refetch()} type="button">Повторить</button></section>;

  const items = query.data.pages.flatMap((page) => page.items);
  return <div className="management-workspace"><section className="audit-filter"><label>Тип действия<select value={action} onChange={(event) => setAction(event.target.value)}><option value="">Все действия</option><option value="organization.updated">Настройки организации</option><option value="organization.member.role_updated">Роли сотрудников</option><option value="ai_instruction_set.updated">Стили ответов</option><option value="knowledge_entry.updated">Данные для ответов</option></select></label><p>Журнал доступен только для чтения.</p></section>{items.length === 0 ? <section className="management-state"><h2>Действий пока нет</h2><p>Новые изменения появятся здесь автоматически.</p></section> : <section className="audit-timeline" aria-label="Журнал действий">{items.map((item) => <AuditItem item={item} key={item.id} />)}</section>}{query.hasNextPage ? <button className="button button-secondary audit-more" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()} type="button">{query.isFetchingNextPage ? "Загружаем..." : "Показать ещё"}</button> : null}</div>;
}

function AuditItem({ item }: { item: AuditLog }) {
  const metadata = sanitizeMetadata(item.metadata);
  return <article className="audit-item"><div className="audit-marker" aria-hidden="true" /><div><header><div><h2>{actionLabels[item.action] ?? "Другое действие"}</h2><p>{entityLabels[item.entity_type] ?? "Объект организации"}</p></div><time dateTime={item.created_at}>{formatDate(item.created_at)}</time></header>{Object.keys(metadata).length ? <dl>{Object.entries(metadata).map(([key, value]) => <div key={key}><dt>{metadataLabel(key)}</dt><dd>{formatValue(value)}</dd></div>)}</dl> : null}</div></article>;
}

function sanitizeMetadata(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !sensitiveKey.test(key)).map(([key, item]) => [key, sanitizeValue(item)]));
}
function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !sensitiveKey.test(key)).map(([key, item]) => [key, sanitizeValue(item)]));
  return value;
}
function metadataLabel(key: string): string { return ({ role: "Роль", scope: "Область", category: "Категория", changed_fields: "Изменённые поля", status: "Статус", default: "Основной стиль" } as Record<string, string>)[key] ?? "Деталь"; }
function formatValue(value: unknown): string { if (Array.isArray(value)) return value.map(formatValue).join(", "); if (value && typeof value === "object") return "Изменено"; if (typeof value === "boolean") return value ? "Да" : "Нет"; return String(value ?? "—"); }
function formatDate(value: string): string { return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : "Неизвестная ошибка"; }
