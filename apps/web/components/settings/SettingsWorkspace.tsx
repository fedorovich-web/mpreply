"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { apiRequest } from "../../lib/api/client";
import { organizationSchema } from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";

export function SettingsWorkspace() {
  const { activeOrganization } = useWorkspace();
  const organizationQuery = useQuery({ queryKey: ["organization", activeOrganization.id], queryFn: () => apiRequest(`/api/organizations/${activeOrganization.id}`, organizationSchema) });
  if (organizationQuery.isPending) return <section className="management-state"><h2>Загружаем настройки</h2><p>Получаем актуальные параметры организации.</p></section>;
  if (organizationQuery.error) return <section className="management-state is-error" role="alert"><h2>Не удалось загрузить настройки</h2><p>{errorMessage(organizationQuery.error)}</p><button className="button button-secondary" onClick={() => void organizationQuery.refetch()} type="button">Повторить</button></section>;
  return <SettingsContent key={`${activeOrganization.id}:${organizationQuery.data.updated_at}`} organization={organizationQuery.data} role={activeOrganization.current_user_role} />;
}

function SettingsContent({ organization, role }: { organization: typeof organizationSchema._output; role: "owner" | "admin" | "manager" | "viewer" }) {
  const organizationId = organization.id;
  const canWrite = role === "owner" || role === "admin";
  const queryClient = useQueryClient();
  const [name, setName] = useState(organization.name);
  const [responseMode, setResponseMode] = useState<"auto" | "semi_auto">(organization.default_response_mode === "semi_auto" ? "semi_auto" : "auto");

  const saveMutation = useMutation({
    mutationFn: () => apiRequest(`/api/organizations/${organizationId}`, organizationSchema, { method: "PATCH", body: { name: name.trim(), default_response_mode: responseMode } }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["organization", organizationId] }),
        queryClient.invalidateQueries({ queryKey: ["organizations"] }),
      ]);
    },
  });

  return <div className="management-workspace"><section className="management-panel"><header><div><h2>Основные настройки</h2></div>{!canWrite ? <span className="status-badge">Только просмотр</span> : null}</header><form className="settings-form" onSubmit={(event) => { event.preventDefault(); if (canWrite && !saveMutation.isPending) saveMutation.mutate(); }}><label>Название организации<input aria-label="Название организации" disabled={!canWrite} maxLength={255} minLength={2} required value={name} onChange={(event) => setName(event.target.value)} /></label><label>Режим ответов по умолчанию<select aria-label="Режим ответов по умолчанию" disabled={!canWrite} value={responseMode} onChange={(event) => setResponseMode(event.target.value as "auto" | "semi_auto")}><option value="auto">Автоматически, с защитными остановками</option><option value="semi_auto">С ручным подтверждением</option></select></label><p className="field-help">Правила автоматизации и защитные условия могут переопределить этот режим для конкретных обращений.</p>{saveMutation.error ? <p className="form-error" role="alert">{errorMessage(saveMutation.error)}</p> : null}{saveMutation.isSuccess ? <p className="form-success" role="status">Настройки сохранены.</p> : null}{canWrite ? <button className="button button-primary" disabled={saveMutation.isPending || name.trim().length < 2} type="submit">{saveMutation.isPending ? "Сохраняем..." : "Сохранить настройки"}</button> : <p className="policy-readonly">Только просмотр: изменения доступны владельцу и администратору.</p>}</form></section></div>;
}

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : "Неизвестная ошибка"; }
