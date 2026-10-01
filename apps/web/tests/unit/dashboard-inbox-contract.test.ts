import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const inbox = readFileSync(join(root, "components/inbox/InboxWorkspace.tsx"), "utf8");
const page = readFileSync(join(root, "app/app/inbox/page.tsx"), "utf8");
const layout = readFileSync(join(root, "styles/dashboard.ts"), "utf8");
const styles = readFileSync(join(root, "styles/dashboard-inbox-approved.css"), "utf8");

describe("inbox operational workspace", () => {
  it("keeps filtering attached to the real message endpoint and persists user choices", () => {
    expect(inbox).toContain('buildApiQuery("/api/messages"');
    expect(inbox).toContain("marketplace:");
    expect(inbox).toContain("assigned_to:");
    expect(inbox).toContain('marketplace: "Площадка"');
    expect(inbox).toContain('assignee: "Ответственный"');
    expect(inbox).toContain("Назначено мне");
    expect(inbox).toContain("mpreply.inbox.filters.");
    expect(inbox).toContain("const { activeOrganization, user, locale } = useWorkspace()");
    expect(inbox).toContain("window.localStorage.setItem");
    expect(inbox).toContain('buildApiQuery("/api/analytics/overview"');
  });

  it("keeps server pagination reachable without losing the active filters", () => {
    expect(inbox).toContain("const [page, setPage] = useState(1)");
    expect(inbox).toContain("page_size: inboxPageSize");
    expect(inbox).toContain("const inboxPageSize = 8");
    expect(inbox).toContain("aria-label={t.nextPage}");
    expect(inbox).toContain("без оценки на странице");
    expect(styles).toContain(".inbox-pagination");
  });

  it("keeps stale queue data visible when only a background refresh fails", () => {
    expect(inbox).toContain("messagesQuery.error && !messagesQuery.data");
    expect(inbox).toContain("messagesQuery.error && messagesQuery.data");
    expect(inbox).toContain("inbox-refresh-error");
    expect(inbox).toContain('tone="error"');
    expect(inbox).toContain("actionDisabled={messagesQuery.isFetching}");
    expect(inbox).toContain("actionLabel={messagesQuery.isFetching ? t.retrying : t.retry}");
    expect(inbox).not.toContain("messagesQuery.data?.total ?? 0} обращений");
    expect(styles).toContain(".inbox-list-state");
    expect(styles).toContain(".inbox-refresh-error");
  });

  it("keeps the table-detail flow keyboard-operable and the next action explicit", () => {
    expect(inbox).toContain('aria-pressed={isSelected}');
    expect(inbox).toContain("inbox-next-step");
    expect(inbox).toContain("Следующий шаг");
    expect(inbox).toContain("Контекст товара");
    expect(inbox).toContain("Ответ для проверки");
    expect(inbox).toContain("Передать на проверку");
    expect(inbox).toContain('localizedPath(locale, "/app/review-queue")');
  });

  it("maps workflow states to truthful next steps and review handoffs", () => {
    expect(inbox).toContain('status === "approved"');
    expect(inbox).toContain('status === "auto_reply_pending"');
    expect(inbox).toContain('status === "sending"');
    expect(inbox).toContain('status === "duplicate"');
    expect(inbox).toContain('status === "skipped"');
    expect(inbox).toContain("Ответ одобрен и ожидает отправки");
    expect(inbox).toContain("Автоответ поставлен в очередь");
    expect(inbox).toContain("Ответ отправляется на маркетплейс");
    expect(inbox).toContain("Повторное обращение уже обработано");
    expect(inbox).toContain("Обращение пропущено автоматизацией");
    expect(inbox).toContain("function isReviewWorkflowStatus");
    expect(inbox).toContain('["waiting_review", "needs_manual_check", "safety_blocked", "approved"]');
    expect(inbox).toContain("const canUseMessageActions");
    for (const protectedStatus of ["approved", "auto_reply_pending", "sending", "answered", "auto_reply_sent", "archived", "duplicate", "skipped"]) {
      expect(inbox).toContain(`"${protectedStatus}"`);
    }
    expect(inbox).toContain("inbox-review-handoff");
    expect(styles).toContain(".inbox-next-step-danger");
    expect(styles).toContain(".inbox-next-step-warning");
    expect(styles).toContain(".inbox-next-step-success");
  });

  it("moves mobile triage from the selected row to its detail without changing desktop behavior", () => {
    expect(inbox).toContain("const detailPanelRef = useRef");
    expect(inbox).toContain("function selectMessage");
    expect(inbox).toContain('window.matchMedia("(max-width: 820px)")');
    expect(inbox).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
    expect(inbox).toContain("detailPanelRef.current?.scrollIntoView");
    expect(inbox).toContain("ref={detailPanelRef}");
    expect(styles).toContain("scroll-margin-top:");
  });

  it("uses the approved Обращения / На проверке vocabulary throughout the workflow", () => {
    expect(inbox).toContain("Все обращения");
    expect(inbox).toContain("Продолжите работу в разделе «На проверке»");
    expect(inbox).toContain("Открыть очередь проверки");
    expect(inbox).toContain("попадёт в раздел «На проверке»");
    expect(inbox).not.toContain("Все входящие");
    expect(inbox).not.toContain("очереди модерации");
    expect(inbox).not.toContain("Открыть модерацию");
    expect(inbox).not.toContain("попадёт в «Модерацию»");
  });

  it("uses known role information before showing write actions", () => {
    expect(inbox).toContain('new Set(["owner", "admin", "manager"])');
    expect(inbox).toContain("canManageMessages");
    expect(inbox).toContain("inbox-readonly-note");
    expect(inbox).toContain("Ваша роль позволяет просматривать обращения");
  });

  it("loads a scoped responsive inbox style layer without a second palette", () => {
    expect(layout).toContain('import "./dashboard-inbox-approved.css"');
    expect(styles).toContain(".inbox-workspace");
    expect(styles).toContain(".inbox-kpi-grid");
    expect(styles).toContain(".inbox-toolbar");
    expect(styles).toContain(".inbox-filter-drawer");
    expect(styles).toContain(".inbox-message-table");
    expect(styles).toContain(".inbox-table-row-selected");
    expect(styles).toContain(".inbox-side-default");
    expect(styles).toContain(".inbox-manual-draft-field");
    expect(styles).toContain("@media (max-width: 520px)");
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("frames the page around triage with the approved product label", () => {
    expect(page).toContain("<h1>Обращения</h1>");
    expect(page).toContain("Фильтруйте очередь по площадке, типу, статусу, оценке и ответственному");
    expect(page).not.toContain("status-badge");
    expect(page).not.toMatch(/экономи|процент|рост|эффективност/i);
  });
});