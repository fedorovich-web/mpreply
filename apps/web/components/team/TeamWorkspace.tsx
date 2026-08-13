"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { apiRequest } from "../../lib/api/client";
import {
  invitationCreatedSchema,
  invitationListSchema,
  invitationSchema,
  messageResponseSchema,
  teamMemberListSchema,
  type TeamMember,
  type TeamRole,
} from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";

const roleLabels = { owner: "Владелец", admin: "Администратор", manager: "Менеджер", viewer: "Наблюдатель" } as const;

export function TeamWorkspace() {
  const { activeOrganization, user } = useWorkspace();
  return <TeamContent key={activeOrganization.id} organizationId={activeOrganization.id} role={activeOrganization.current_user_role} userId={user.id} />;
}

function TeamContent({ organizationId, role, userId }: { organizationId: string; role: "owner" | "admin" | "manager" | "viewer"; userId: string }) {
  const canManage = role === "owner" || role === "admin";
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("manager");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const membersQuery = useQuery({ queryKey: ["team-members", organizationId], queryFn: () => apiRequest(`/api/organizations/${organizationId}/members`, teamMemberListSchema), enabled: canManage });
  const invitationsQuery = useQuery({ queryKey: ["team-invitations", organizationId], queryFn: () => apiRequest(`/api/organizations/${organizationId}/invitations`, invitationListSchema), enabled: canManage });

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["team-members", organizationId] }),
      queryClient.invalidateQueries({ queryKey: ["team-invitations", organizationId] }),
    ]);
  }

  const inviteMutation = useMutation({
    mutationFn: () => apiRequest(`/api/organizations/${organizationId}/invitations`, invitationCreatedSchema, { method: "POST", body: { email: email.trim().toLowerCase(), role: inviteRole } }),
    onSuccess: async (result) => {
      setEmail("");
      setInviteLink(`${window.location.origin}/auth/invitations?token=${encodeURIComponent(result.accept_token)}`);
      await queryClient.invalidateQueries({ queryKey: ["team-invitations", organizationId] });
    },
  });
  const roleMutation = useMutation({
    mutationFn: ({ member, nextRole }: { member: TeamMember; nextRole: TeamRole }) => apiRequest(`/api/organizations/${organizationId}/members/${member.membership_id}`, messageResponseSchema, { method: "PATCH", body: { role: nextRole } }),
    onSuccess: refresh,
  });
  const removeMutation = useMutation({
    mutationFn: (member: TeamMember) => apiRequest(`/api/organizations/${organizationId}/members/${member.membership_id}`, messageResponseSchema, { method: "DELETE" }),
    onSuccess: refresh,
  });
  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) => apiRequest(`/api/organizations/${organizationId}/invitations/${invitationId}`, invitationSchema, { method: "DELETE" }),
    onSuccess: refresh,
  });

  if (!canManage) return <section className="management-state"><h2>Список сотрудников недоступен</h2><p>Состав сотрудников и приглашения доступны владельцу и администратору организации.</p></section>;
  const error = membersQuery.error ?? invitationsQuery.error;
  if (membersQuery.isPending || invitationsQuery.isPending) return <section className="management-state"><h2>Загружаем команду</h2><p>Получаем сотрудников и активные приглашения.</p></section>;
  if (error) return <section className="management-state is-error" role="alert"><h2>Не удалось загрузить команду</h2><p>{errorMessage(error)}</p><button className="button button-secondary" onClick={() => { void membersQuery.refetch(); void invitationsQuery.refetch(); }} type="button">Повторить</button></section>;

  return <div className="management-workspace">
    <section className="management-panel"><header><div><h2>Пригласить сотрудника</h2></div></header><form className="team-invite-form" onSubmit={(event) => { event.preventDefault(); if (!inviteMutation.isPending) inviteMutation.mutate(); }}><label>Email сотрудника<input aria-label="Email сотрудника" autoComplete="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Роль<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as TeamRole)}><option value="admin">Администратор</option><option value="manager">Менеджер</option><option value="viewer">Наблюдатель</option></select></label><button className="button button-primary" disabled={inviteMutation.isPending || !email.trim()} type="submit">{inviteMutation.isPending ? "Создаём..." : "Отправить приглашение"}</button></form>{inviteMutation.error ? <p className="form-error" role="alert">{errorMessage(inviteMutation.error)}</p> : null}{inviteLink ? <div className="team-invite-link" role="status"><p>Передайте сотруднику одноразовую ссылку:</p><input aria-label="Ссылка приглашения" readOnly value={inviteLink} /><button className="button button-secondary" onClick={() => void navigator.clipboard?.writeText(inviteLink)} type="button">Скопировать ссылку</button></div> : null}</section>
    <section className="management-panel"><header><div><h2>Сотрудники</h2></div><span className="status-badge">{membersQuery.data?.length ?? 0}</span></header><div className="team-list">{membersQuery.data?.map((member) => <article className="team-row" key={member.membership_id}><div><strong>{member.name || member.email}</strong><span>{member.email}</span></div><label>Роль <select aria-label={`Роль ${member.name || member.email}`} disabled={member.role === "owner" || member.user_id === userId || roleMutation.isPending} value={member.role} onChange={(event) => roleMutation.mutate({ member, nextRole: event.target.value as TeamRole })}>{member.role === "owner" ? <option value="owner">Владелец</option> : null}<option value="admin">Администратор</option><option value="manager">Менеджер</option><option value="viewer">Наблюдатель</option></select></label>{member.role !== "owner" && member.user_id !== userId ? <button className="button button-secondary" disabled={removeMutation.isPending} aria-label={`Удалить ${member.name || member.email}`} onClick={() => { if (window.confirm(`Удалить ${member.name || member.email} из команды?`)) removeMutation.mutate(member); }} type="button">Удалить</button> : <span className="team-guard-note">{roleLabels[member.role]}</span>}</article>)}</div>{roleMutation.error || removeMutation.error ? <p className="form-error" role="alert">{errorMessage(roleMutation.error ?? removeMutation.error)}</p> : null}</section>
    <section className="management-panel"><header><div><h2>Приглашения</h2></div></header>{invitationsQuery.data?.length ? <div className="team-list">{invitationsQuery.data.map((item) => <article className="team-row" key={item.id}><div><strong>{item.email}</strong><span>{roleLabels[item.role]} · до {formatDate(item.expires_at)}</span></div><span className="status-badge">{item.status === "pending" ? "Ожидает" : "Закрыто"}</span>{item.status === "pending" ? <button className="button button-secondary" disabled={revokeMutation.isPending} onClick={() => revokeMutation.mutate(item.id)} type="button">Отозвать</button> : null}</article>)}</div> : <p>Активных приглашений нет.</p>}</section>
  </div>;
}

function formatDate(value: string): string { return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(value)); }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : "Неизвестная ошибка"; }
