"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";

import { apiRequest, buildApiQuery } from "../../lib/api/client";
import {
  knowledgeEntryListSchema,
  knowledgeEntrySchema,
  marketplaceAccountListSchema,
  customerMessageListSchema,
  type KnowledgeCategory,
  type KnowledgeEntry,
  type KnowledgeStatus,
  type MarketplaceAccount,
  type ProductSummary,
} from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";

type EditorState = {
  category: KnowledgeCategory;
  title: string;
  content: string;
  status: KnowledgeStatus;
  marketplaceAccountId: string;
  productId: string;
};

type ScopedProduct = ProductSummary & { marketplaceAccountId: string };

const categoryLabels: Record<KnowledgeCategory, string> = {
  company: "О компании",
  delivery: "Доставка",
  returns: "Возвраты",
  warranty: "Гарантия",
  product: "Товар",
  other: "Другое",
};

export function KnowledgeBaseWorkspace() {
  const { activeOrganization } = useWorkspace();
  return (
    <KnowledgeBaseContent
      key={activeOrganization.id}
      organizationId={activeOrganization.id}
      role={activeOrganization.current_user_role}
    />
  );
}

function KnowledgeBaseContent({
  organizationId,
  role,
}: {
  organizationId: string;
  role: "owner" | "admin" | "manager" | "viewer";
}) {
  const queryClient = useQueryClient();
  const canWrite = role === "owner" || role === "admin";
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<KnowledgeStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState<KnowledgeCategory | "">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [editor, setEditor] = useState<EditorState>(emptyEditor);

  const entriesQuery = useQuery({
    queryKey: ["knowledge-entries", organizationId, deferredSearch, statusFilter, categoryFilter],
    queryFn: () => apiRequest(
      buildApiQuery(`/api/organizations/${organizationId}/knowledge-entries`, {
        search: deferredSearch.trim() || null,
        status: statusFilter || null,
        category: categoryFilter || null,
      }),
      knowledgeEntryListSchema,
    ),
  });
  const accountsQuery = useQuery({
    queryKey: ["marketplace-accounts", organizationId],
    queryFn: () => apiRequest(buildApiQuery("/api/marketplace-accounts", { organization_id: organizationId }), marketplaceAccountListSchema),
  });
  const messagesQuery = useQuery({
    queryKey: ["knowledge-product-options", organizationId],
    queryFn: () => apiRequest(buildApiQuery("/api/messages", { organization_id: organizationId, page: 1, page_size: 100 }), customerMessageListSchema),
    enabled: editorMode !== null,
  });
  const products = Array.from(
    new Map(
      (messagesQuery.data?.items ?? [])
        .filter((message) => message.product)
        .map((message) => [
          message.product!.id,
          { ...message.product!, marketplaceAccountId: message.marketplace_account_id },
        ]),
    ).values(),
  );
  const selected = entriesQuery.data?.find((item) => item.id === selectedId) ?? entriesQuery.data?.[0] ?? null;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["knowledge-entries", organizationId] });
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        category: editor.category,
        title: editor.title.trim(),
        content: editor.content.trim(),
        status: editor.status,
        marketplace_account_id: editor.marketplaceAccountId || null,
        product_id: editor.productId || null,
      };
      if (editorMode === "edit" && selected) {
        return apiRequest(`/api/organizations/${organizationId}/knowledge-entries/${selected.id}`, knowledgeEntrySchema, { method: "PATCH", body });
      }
      return apiRequest(`/api/organizations/${organizationId}/knowledge-entries`, knowledgeEntrySchema, { method: "POST", body });
    },
    onSuccess: async (item) => {
      setSelectedId(item.id);
      setEditorMode(null);
      await refresh();
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ item, status }: { item: KnowledgeEntry; status: KnowledgeStatus }) => apiRequest(
      `/api/organizations/${organizationId}/knowledge-entries/${item.id}`,
      knowledgeEntrySchema,
      { method: "PATCH", body: { status } },
    ),
    onSuccess: refresh,
  });

  return (
    <div className="policy-workspace">
      <section className="policy-toolbar">
        <div><h2>Проверенные сведения</h2><p>Только текст, который система может использовать как фактический контекст ответа.</p></div>
        {canWrite ? <button className="button button-primary" onClick={() => { setEditor(emptyEditor()); setEditorMode("create"); }} type="button">Добавить запись</button> : <p className="policy-readonly" role="status">Только просмотр: изменения доступны владельцу и администратору.</p>}
      </section>

      <section className="knowledge-filters" aria-label="Фильтры данных для ответов">
        <label>Поиск по данным для ответов<input aria-label="Поиск по данным для ответов" role="searchbox" maxLength={160} placeholder="Название или фраза" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label>Категория<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as KnowledgeCategory | "")}><option value="">Все категории</option>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Статус<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as KnowledgeStatus | "")}><option value="">Все статусы</option><option value="active">Активные</option><option value="draft">Черновики</option><option value="archived">Архив</option></select></label>
      </section>

      {entriesQuery.isPending ? <PolicyState title="Загружаем данные для ответов" description="Получаем актуальные записи." /> : entriesQuery.error ? <PolicyState error title="Не удалось загрузить данные для ответов" description={errorMessage(entriesQuery.error)} onRetry={() => void entriesQuery.refetch()} /> : entriesQuery.data.length === 0 ? <PolicyState title="Проверенных данных пока нет" description={search || categoryFilter || statusFilter ? "По выбранным фильтрам записей нет." : "Добавьте проверенные сведения о компании, доставке, возвратах и товарах."} action={canWrite && !search && !categoryFilter && !statusFilter ? <button className="button button-secondary" onClick={() => { setEditor(emptyEditor()); setEditorMode("create"); }} type="button">Добавить первую запись</button> : null} /> : (
        <div className="policy-layout">
          <section className="policy-list" aria-label="Проверенные данные для ответов">
            {entriesQuery.data.map((item) => <button className="policy-list-item" aria-pressed={selected?.id === item.id} key={item.id} onClick={() => { setSelectedId(item.id); setEditorMode(null); }} type="button"><span><strong>{item.title}</strong><small>{categoryLabels[item.category]}</small></span><span>{item.status === "active" ? "Используется" : item.status === "draft" ? "Черновик" : "В архиве"}</span></button>)}
          </section>
          <section className="policy-detail">
            {editorMode ? <KnowledgeEditor accounts={accountsQuery.data ?? []} products={products} state={editor} mode={editorMode} pending={saveMutation.isPending} error={saveMutation.error} onChange={setEditor} onCancel={() => setEditorMode(null)} onSubmit={() => saveMutation.mutate()} /> : selected ? <article className="policy-card knowledge-card"><header><div><p className="eyebrow">{categoryLabels[selected.category]}</p><h2>{selected.title}</h2></div><span className="status-badge">{selected.status === "active" ? "Используется" : selected.status === "draft" ? "Черновик" : "Архив"}</span></header><p>{selected.content}</p><dl className="policy-facts"><div><dt>Область</dt><dd>{selected.product_id ? "Конкретный товар" : selected.marketplace_account_id ? "Кабинет маркетплейса" : "Вся организация"}</dd></div><div><dt>Обновлено</dt><dd>{formatDate(selected.updated_at)}</dd></div></dl>{canWrite ? <div className="policy-actions"><button className="button button-secondary" onClick={() => { setEditor(fromEntry(selected)); setEditorMode("edit"); }} type="button">Редактировать</button>{selected.status !== "active" ? <button className="button button-secondary" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ item: selected, status: "active" })} type="button">Активировать</button> : <button className="button button-secondary" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ item: selected, status: "archived" })} type="button">В архив</button>}</div> : null}{statusMutation.error ? <p className="form-error" role="alert">{errorMessage(statusMutation.error)}</p> : null}</article> : null}
          </section>
        </div>
      )}
    </div>
  );
}

function KnowledgeEditor({ accounts, products, state, mode, pending, error, onChange, onCancel, onSubmit }: { accounts: MarketplaceAccount[]; products: ScopedProduct[]; state: EditorState; mode: "create" | "edit"; pending: boolean; error: unknown; onChange: (value: EditorState) => void; onCancel: () => void; onSubmit: () => void }) {
  const set = <K extends keyof EditorState>(key: K, value: EditorState[K]) => onChange({ ...state, [key]: value });
  const availableProducts = products.filter((product) => product.marketplaceAccountId === state.marketplaceAccountId);
  return <form aria-label="Редактор данных для ответов" className="policy-editor" onSubmit={(event) => { event.preventDefault(); if (!pending) onSubmit(); }}><h2>{mode === "create" ? "Новая запись" : "Редактирование записи"}</h2><label>Категория<select value={state.category} onChange={(event) => set("category", event.target.value as KnowledgeCategory)}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Кабинет маркетплейса<select value={state.marketplaceAccountId} onChange={(event) => onChange({ ...state, marketplaceAccountId: event.target.value, productId: "" })}><option value="">Вся организация</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.display_name}</option>)}</select></label><label>Товар<select disabled={!state.marketplaceAccountId || availableProducts.length === 0} value={state.productId} onChange={(event) => set("productId", event.target.value)}><option value="">Все товары кабинета</option>{availableProducts.map((product) => <option key={product.id} value={product.id}>{product.name}{product.sku ? ` · ${product.sku}` : ""}</option>)}</select></label><label>Заголовок<input maxLength={160} required value={state.title} onChange={(event) => set("title", event.target.value)} /></label><label>Проверенные сведения<textarea maxLength={12000} required rows={10} value={state.content} onChange={(event) => set("content", event.target.value)} /></label><label>Статус<select value={state.status} onChange={(event) => set("status", event.target.value as KnowledgeStatus)}><option value="active">Использовать в ответах</option><option value="draft">Сохранить черновиком</option><option value="archived">Архив</option></select></label><p className="field-help">Не добавляйте предположения, внутренние секреты и непроверенные обещания.</p>{error ? <p className="form-error" role="alert">{errorMessage(error)}</p> : null}<div className="policy-actions"><button className="button button-primary" disabled={pending || !state.title.trim() || !state.content.trim()} type="submit">{pending ? "Сохраняем..." : mode === "create" ? "Добавить запись" : "Сохранить"}</button><button className="button button-secondary" disabled={pending} onClick={onCancel} type="button">Отмена</button></div></form>;
}

function PolicyState({ title, description, error = false, onRetry, action }: { title: string; description: string; error?: boolean; onRetry?: () => void; action?: React.ReactNode }) { return <section className={`policy-state${error ? " is-error" : ""}`} role={error ? "alert" : undefined}><h2>{title}</h2><p>{description}</p>{onRetry ? <button className="button button-secondary" onClick={onRetry} type="button">Повторить</button> : action}</section>; }
function emptyEditor(): EditorState { return { category: "company", title: "", content: "", status: "active", marketplaceAccountId: "", productId: "" }; }
function fromEntry(item: KnowledgeEntry): EditorState { return { category: item.category, title: item.title, content: item.content, status: item.status, marketplaceAccountId: item.marketplace_account_id ?? "", productId: item.product_id ?? "" }; }
function formatDate(value: string): string { return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : "Неизвестная ошибка"; }
