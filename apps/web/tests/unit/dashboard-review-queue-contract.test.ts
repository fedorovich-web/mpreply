import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const workspace = readFileSync(join(root, "components/review-queue/ReviewQueueWorkspace.tsx"), "utf8");
const page = readFileSync(join(root, "app/app/review-queue/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const styles = readFileSync(join(root, "styles/dashboard-review-queue-approved.css"), "utf8");

describe("review queue operational workspace", () => {
  it("keeps the queue attached to the live manual-review workflow", () => {
    expect(workspace).toContain('buildApiQuery("/api/replies/review-queue"');
    expect(workspace).toContain("/submit-review");
    expect(workspace).toContain("/approve");
    expect(workspace).toContain("/reject");
    expect(workspace).toContain("/send");
  });

  it("keeps loaded review work visible through background refresh failures", () => {
    expect(workspace).toContain("queueQuery.error && !queueQuery.data");
    expect(workspace).toContain("queueQuery.error && queueQuery.data");
    expect(workspace).toContain("review-queue-refresh-error");
    expect(workspace).toContain('actionDisabled={queueQuery.isFetching}');
    expect(workspace).toContain("actionLabel={queueQuery.isFetching ? t.retrying : t.retry}");
    expect(styles).toContain(".review-queue-state");
    expect(styles).toContain(".review-queue-refresh-error");
  });

  it("keeps backend implementation wording out of seller-facing action errors", () => {
    expect(workspace).toContain("function reviewActionErrorMessage");
    expect(workspace).toContain("Ответ нельзя одобрить в текущем виде");
    expect(workspace).toContain("Ответ нельзя отправить в текущем виде");
    expect(workspace).toContain("Ответ уже изменился");
    expect(workspace).not.toContain("{errorMessage(activeError)}");
  });

  it("moves mobile selection to the review editor while respecting reduced motion", () => {
    expect(workspace).toContain("const editorPanelRef = useRef");
    expect(workspace).toContain("function selectReviewItem");
    expect(workspace).toContain('window.matchMedia("(max-width: 980px)")');
    expect(workspace).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
    expect(workspace).toContain("editorPanelRef.current?.scrollIntoView");
    expect(styles).toContain(".review-editor-slot");
    expect(styles).toContain("scroll-margin-top:");
  });

  it("keeps review context and reason next to the decision", () => {
    expect(workspace).toContain('aria-pressed={item.reply.id === selected?.reply.id}');
    expect(workspace).toContain("Почему требуется внимание");
    expect(workspace).toContain("Обращение покупателя");
    expect(workspace).toContain("Контекст товара");
    expect(workspace).toContain("Что произойдёт дальше");
    expect(workspace).not.toContain("SafetyGate");
    expect(workspace).not.toContain("worker pipeline");
  });

  it("keeps paginated review work reachable beyond the first API page", () => {
    expect(workspace).toContain("const [page, setPage] = useState(1)");
    expect(workspace).toContain("page_size: reviewQueuePageSize");
    expect(workspace).toContain("const reviewQueuePageSize = 20");
    expect(styles).toContain("max-height: 37.5rem");
    expect(workspace).toContain("aria-label={t.nextPage}");
    expect(styles).toContain(".review-queue-pagination");
  });

  it("prevents known read-only roles from discovering permissions through a failed click", () => {
    expect(workspace).toContain('new Set(["owner", "admin", "manager"])');
    expect(workspace).toContain("canManageReview");
    expect(workspace).toContain("const { activeOrganization, locale } = useWorkspace()");
    expect(workspace).toContain("review-readonly-note");
    expect(workspace).toContain("Ваша роль позволяет просматривать очередь");
  });

  it("loads a scoped responsive review style layer without a second palette", () => {
    expect(layout).toContain('import "../styles/dashboard-review-queue-approved.css"');
    expect(styles).toContain(".review-queue-page");
    expect(styles).toContain(".review-queue-workspace");
    expect(styles).toContain(".review-attention-reason");
    expect(styles).toContain(".review-editor-actions");
    expect(styles).toContain("@media (max-width: 520px)");
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("frames the page around decisions with the approved product label", () => {
    expect(page).toContain("<h1>На проверке</h1>");
    expect(page).toContain("обращение, товар и причина остановки остаются рядом");
    expect(page).not.toContain("status-badge");
    expect(page).not.toContain("История изменений");
  });
});