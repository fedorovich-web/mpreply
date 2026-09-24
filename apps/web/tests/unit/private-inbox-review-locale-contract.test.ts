import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const inbox = readFileSync(join(root, "components/inbox/InboxWorkspace.tsx"), "utf8");
const review = readFileSync(join(root, "components/review-queue/ReviewQueueWorkspace.tsx"), "utf8");
const enInbox = readFileSync(join(root, "app/en/app/inbox/page.tsx"), "utf8");
const enReview = readFileSync(join(root, "app/en/app/review-queue/page.tsx"), "utf8");

describe("private inbox and review queue locale separation", () => {
  it("keeps one live inbox workflow with locale-specific copy", () => {
    expect(inbox).toContain("const { activeOrganization, user, locale } = useWorkspace()");
    expect(inbox).toContain('buildApiQuery("/api/messages"');
    expect(inbox).toContain('apiRequest("/api/replies/manual"');
    expect(inbox).toContain("/submit-review");
    expect(inbox).toContain('localizedPath(locale, "/app/review-queue")');
    expect(inbox).toContain('loadingTitle: "Loading messages"');
    expect(inbox).toContain('loadingTitle: "Загружаем обращения"');
  });

  it("keeps one live review workflow with locale-specific copy", () => {
    expect(review).toContain("const { activeOrganization, locale } = useWorkspace()");
    expect(review).toContain('buildApiQuery("/api/replies/review-queue"');
    for (const action of ["/draft", "/submit-review", "/approve", "/reject", "/send"]) {
      expect(review).toContain(action);
    }
    expect(review).toContain('emptyTitle: "Nothing needs review right now"');
    expect(review).toContain('emptyTitle: "На проверке ничего нет"');
  });

  it("provides explicit English private routes without duplicating backend APIs", () => {
    expect(enInbox).toContain("<InboxWorkspace />");
    expect(enReview).toContain("<ReviewQueueWorkspace />");
    expect(enInbox).not.toMatch(/[А-Яа-яЁё]/);
    expect(enReview).not.toMatch(/[А-Яа-яЁё]/);
  });
});
