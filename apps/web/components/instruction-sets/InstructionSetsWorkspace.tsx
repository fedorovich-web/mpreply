"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { apiRequest, buildApiQuery } from "../../lib/api/client";
import {
  aiInstructionSetAssignmentSchema,
  aiInstructionSetListSchema,
  aiInstructionSetSchema,
  marketplaceAccountListSchema,
  type AIInstructionSet,
  type InstructionTone,
} from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";

type EditorState = {
  name: string;
  responseTone: InstructionTone;
  brandRules: string;
  replySignature: string;
  prohibitedPhrases: string;
};

const toneLabels: Record<InstructionTone, string> = {
  neutral: "Нейтральный",
  friendly: "Доброжелательный",
  formal: "Официальный",
  apologetic: "Эмпатичный",
};

export function InstructionSetsWorkspace() {
  const { activeOrganization } = useWorkspace();
  return (
    <InstructionSetsContent
      key={activeOrganization.id}
      organizationId={activeOrganization.id}
      role={activeOrganization.current_user_role}
    />
  );
}

function InstructionSetsContent({
  organizationId,
  role,
}: {
  organizationId: string;
  role: "owner" | "admin" | "manager" | "viewer";
}) {
  const queryClient = useQueryClient();
  const canWrite = role === "owner" || role === "admin";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [editor, setEditor] = useState<EditorState>(emptyEditor);

  const setsQuery = useQuery({
    queryKey: ["instruction-sets", organizationId],
    queryFn: () => apiRequest(`/api/organizations/${organizationId}/instruction-sets`, aiInstructionSetListSchema),
  });
  const accountsQuery = useQuery({
    queryKey: ["marketplace-accounts", organizationId],
    queryFn: () => apiRequest(buildApiQuery("/api/marketplace-accounts", { organization_id: organizationId }), marketplaceAccountListSchema),
  });
  const sets = setsQuery.data ?? [];
  const accounts = accountsQuery.data ?? [];
  const selected = sets.find((item) => item.id === selectedId) ?? sets[0] ?? null;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["instruction-sets", organizationId] });
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        name: editor.name.trim(),
        response_tone: editor.responseTone,
        brand_rules: nullableText(editor.brandRules),
        reply_signature: nullableText(editor.replySignature),
        prohibited_phrases: lines(editor.prohibitedPhrases),
      };
      if (editorMode === "edit" && selected) {
        return apiRequest(`/api/organizations/${organizationId}/instruction-sets/${selected.id}`, aiInstructionSetSchema, { method: "PATCH", body });
      }
      return apiRequest(`/api/organizations/${organizationId}/instruction-sets`, aiInstructionSetSchema, { method: "POST", body });
    },
    onSuccess: async (item) => {
      setSelectedId(item.id);
      setEditorMode(null);
      await refresh();
    },
  });
  const stateMutation = useMutation({
    mutationFn: ({ item, action }: { item: AIInstructionSet; action: "default" | "archive" | "restore" }) => (
      action === "default"
        ? apiRequest(`/api/organizations/${organizationId}/instruction-sets/${item.id}/make-default`, aiInstructionSetSchema, { method: "POST" })
        : apiRequest(`/api/organizations/${organizationId}/instruction-sets/${item.id}`, aiInstructionSetSchema, { method: "PATCH", body: { status: action === "archive" ? "archived" : "active" } })
    ),
    onSuccess: refresh,
  });
  const assignmentMutation = useMutation({
    mutationFn: ({ accountId, instructionSetId }: { accountId: string; instructionSetId: string | null }) => (
      apiRequest(`/api/marketplace-accounts/${accountId}/instruction-set`, aiInstructionSetAssignmentSchema, {
        method: "PATCH",
        body: { instruction_set_id: instructionSetId },
      })
    ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["marketplace-accounts", organizationId] });
    },
  });

  const queryError = setsQuery.error ?? accountsQuery.error;
  if (setsQuery.isPending || accountsQuery.isPending) {
    return <WorkspaceState title="Загружаем стили ответов" description="Получаем сохранённые настройки и связанные кабинеты." />;
  }
  if (queryError) {
    return <WorkspaceState error title="Не удалось загрузить стили ответов" description={errorMessage(queryError)} onRetry={() => { void setsQuery.refetch(); void accountsQuery.refetch(); }} />;
  }

  return (
    <div className="policy-workspace">
      <section className="policy-toolbar">
        <div>
          <h2>Сохранённые стили</h2>
          <p>Тон, правила компании, подпись и запрещённые фразы для ответов.</p>
        </div>
        {canWrite ? <button className="button button-primary" onClick={() => { setEditor(emptyEditor()); setEditorMode("create"); }} type="button">Добавить стиль</button> : <p className="policy-readonly" role="status">Только просмотр: изменения доступны владельцу и администратору.</p>}
      </section>

      <div className="policy-layout">
        <section className="policy-list" aria-label="Сохранённые стили ответов">
          {sets.length === 0 ? <WorkspaceState title="Сохранённых стилей пока нет" description="Добавьте основной стиль ответов для организации." /> : sets.map((item) => (
            <button className="policy-list-item" aria-pressed={selected?.id === item.id} key={item.id} onClick={() => { setSelectedId(item.id); setEditorMode(null); }} type="button">
              <span><strong>{item.name}</strong>{item.is_default ? <small>По умолчанию</small> : null}</span>
              <span>{toneLabels[item.response_tone]} · {item.status === "active" ? "Активен" : "В архиве"}</span>
            </button>
          ))}
        </section>

        <section className="policy-detail">
          {editorMode ? (
            <InstructionSetEditor state={editor} mode={editorMode} pending={saveMutation.isPending} error={saveMutation.error} onChange={setEditor} onCancel={() => setEditorMode(null)} onSubmit={() => saveMutation.mutate()} />
          ) : selected ? (
            <article className="policy-card">
              <header><div><p className="eyebrow">{selected.is_default ? "Основной стиль" : "Стиль ответов"}</p><h2>{selected.name}</h2></div><span className="status-badge">{toneLabels[selected.response_tone]}</span></header>
              <dl className="policy-facts">
                <div><dt>Правила бренда</dt><dd>{selected.brand_rules || "Не заданы"}</dd></div>
                <div><dt>Подпись</dt><dd>{selected.reply_signature || "Без подписи"}</dd></div>
                <div><dt>Запрещённые фразы</dt><dd>{selected.prohibited_phrases.join(", ") || "Не заданы"}</dd></div>
              </dl>
              {canWrite ? <div className="policy-actions">
                <button className="button button-secondary" onClick={() => { setEditor(fromSet(selected)); setEditorMode("edit"); }} type="button">Редактировать</button>
                {!selected.is_default && selected.status === "active" ? <button className="button button-secondary" disabled={stateMutation.isPending} onClick={() => stateMutation.mutate({ item: selected, action: "default" })} type="button">Сделать основным</button> : null}
                {!selected.is_default ? <button className="button button-secondary" disabled={stateMutation.isPending} onClick={() => stateMutation.mutate({ item: selected, action: selected.status === "active" ? "archive" : "restore" })} type="button">{selected.status === "active" ? "В архив" : "Восстановить"}</button> : null}
              </div> : null}
              {stateMutation.error ? <p className="form-error" role="alert">{errorMessage(stateMutation.error)}</p> : null}
            </article>
          ) : <WorkspaceState title="Выберите стиль" description="Здесь появятся его тон, правила и подпись." />}
        </section>
      </div>

      <section className="policy-assignments" aria-labelledby="instruction-assignments-title">
        <div><h2 id="instruction-assignments-title">Какой стиль используется в кабинете</h2><p>Для каждого подключения можно выбрать свой стиль ответов.</p></div>
        {accounts.length === 0 ? <p>Сначала подключите кабинет маркетплейса.</p> : accounts.map((account) => (
          <label key={account.id}>Стиль ответов для кабинета {account.display_name}
            <select aria-label={`Стиль ответов для кабинета ${account.display_name}`} disabled={!canWrite || assignmentMutation.isPending} value={account.ai_instruction_set_id ?? ""} onChange={(event) => assignmentMutation.mutate({ accountId: account.id, instructionSetId: event.target.value || null })}>
              <option value="">Основной стиль организации</option>
              {sets.filter((item) => item.status === "active").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        ))}
        {assignmentMutation.error ? <p className="form-error" role="alert">{errorMessage(assignmentMutation.error)}</p> : null}
      </section>
    </div>
  );
}

function InstructionSetEditor({ state, mode, pending, error, onChange, onCancel, onSubmit }: { state: EditorState; mode: "create" | "edit"; pending: boolean; error: unknown; onChange: (value: EditorState) => void; onCancel: () => void; onSubmit: () => void }) {
  const set = <K extends keyof EditorState>(key: K, value: EditorState[K]) => onChange({ ...state, [key]: value });
  return <form aria-label="Редактор стиля ответов" className="policy-editor" onSubmit={(event) => { event.preventDefault(); if (!pending) onSubmit(); }}>
    <h2>{mode === "create" ? "Новый стиль ответов" : "Редактирование стиля"}</h2>
    <label>Название<input maxLength={120} minLength={2} required value={state.name} onChange={(event) => set("name", event.target.value)} /></label>
    <label>Тон ответа<select value={state.responseTone} onChange={(event) => set("responseTone", event.target.value as InstructionTone)}>{Object.entries(toneLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Правила бренда<textarea maxLength={2000} rows={5} value={state.brandRules} onChange={(event) => set("brandRules", event.target.value)} /></label>
    <label>Подпись<textarea maxLength={500} rows={2} value={state.replySignature} onChange={(event) => set("replySignature", event.target.value)} /></label>
    <label>Запрещённые фразы<textarea aria-describedby="prohibited-help" rows={4} value={state.prohibitedPhrases} onChange={(event) => set("prohibitedPhrases", event.target.value)} /></label>
    <p id="prohibited-help" className="field-help">Одна фраза на строку.</p>
    {error ? <p className="form-error" role="alert">{errorMessage(error)}</p> : null}
    <div className="policy-actions"><button className="button button-primary" disabled={pending || state.name.trim().length < 2} type="submit">{pending ? "Сохраняем..." : mode === "create" ? "Добавить стиль" : "Сохранить"}</button><button className="button button-secondary" disabled={pending} onClick={onCancel} type="button">Отмена</button></div>
  </form>;
}

function WorkspaceState({ title, description, error = false, onRetry }: { title: string; description: string; error?: boolean; onRetry?: () => void }) {
  return <section className={`policy-state${error ? " is-error" : ""}`} role={error ? "alert" : undefined}><h2>{title}</h2><p>{description}</p>{onRetry ? <button className="button button-secondary" onClick={onRetry} type="button">Повторить</button> : null}</section>;
}

function emptyEditor(): EditorState { return { name: "", responseTone: "neutral", brandRules: "", replySignature: "", prohibitedPhrases: "" }; }
function fromSet(item: AIInstructionSet): EditorState { return { name: item.name, responseTone: item.response_tone, brandRules: item.brand_rules ?? "", replySignature: item.reply_signature ?? "", prohibitedPhrases: item.prohibited_phrases.join("\n") }; }
function nullableText(value: string): string | null { return value.trim() || null; }
function lines(value: string): string[] { return [...new Set(value.split("\n").map((item) => item.trim()).filter(Boolean))]; }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : "Неизвестная ошибка"; }
