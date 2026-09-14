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
    expect(workspace).toContain('aria-label="Следующая страница"');
    expect(styles).toContain(".review-queue-pagination");
  });

  it("prevents known read-only roles from discovering permissions through a failed click", () => {
    expect(workspace).toContain('new Set(["owner", "admin", "manager"])');
    expect(workspace).toContain("canManageReview");
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
    expect(page).toContain('<p className="eyebrow">На проверке</p>');
    expect(page).toContain("Проверьте ответы, которым нужно решение");
    expect(page).toContain("Причина внимания остаётся рядом с ответом");
    expect(page).not.toContain("История изменений");
  });
});