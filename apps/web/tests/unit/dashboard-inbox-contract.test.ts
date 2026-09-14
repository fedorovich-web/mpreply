import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const inbox = readFileSync(join(root, "components/inbox/InboxWorkspace.tsx"), "utf8");
const page = readFileSync(join(root, "app/app/inbox/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const styles = readFileSync(join(root, "styles/dashboard-inbox-approved.css"), "utf8");

describe("inbox operational workspace", () => {
  it("keeps filtering attached to the real message endpoint and persists user choices", () => {
    expect(inbox).toContain('buildApiQuery("/api/messages"');
    expect(inbox).toContain("marketplace:");
    expect(inbox).toContain("assigned_to:");
    expect(inbox).toContain('label="Площадка"');
    expect(inbox).toContain('label="Ответственный"');
    expect(inbox).toContain("Назначено мне");
    expect(inbox).toContain("mpreply.inbox.filters.");
    expect(inbox).toContain("window.localStorage.setItem");
  });

  it("keeps server pagination reachable without losing the active filters", () => {
    expect(inbox).toContain("const [page, setPage] = useState(1)");
    expect(inbox).toContain("page_size: inboxPageSize");
    expect(inbox).toContain('aria-label="Следующая страница"');
    expect(inbox).toContain("без оценки на странице");
    expect(styles).toContain(".inbox-pagination");
  });

  it("keeps the list-detail flow keyboard-operable and the next action explicit", () => {
    expect(inbox).toContain('aria-pressed={isSelected}');
    expect(inbox).toContain("inbox-next-step");
    expect(inbox).toContain("Следующий шаг");
    expect(inbox).toContain("Контекст товара");
    expect(inbox).toContain("Ответ для проверки");
    expect(inbox).toContain("Передать на проверку");
    expect(inbox).toContain('href="/app/review-queue"');
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
    expect(layout).toContain('import "../styles/dashboard-inbox-approved.css"');
    expect(styles).toContain(".inbox-workspace");
    expect(styles).toContain(".inbox-filters-panel");
    expect(styles).toContain(".message-card-selected");
    expect(styles).toContain(".inbox-manual-draft-field");
    expect(styles).toContain("@media (max-width: 520px)");
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("frames the page around triage with the approved product label", () => {
    expect(page).toContain('<p className="eyebrow">Обращения</p>');
    expect(page).toContain("Разберите обращения без переключения между кабинетами");
    expect(page).toContain("Фильтры сохраняются");
    expect(page).not.toMatch(/экономи|процент|рост|эффективност/i);
  });
});