import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(process.cwd(), "..", "..");
const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");

const product = read("PRODUCT.md");
const design = read("DESIGN.md");
const agents = read("AGENTS.md");
const publicBrief = read("docs/product/public-site-master-brief.md");
const seo = read("docs/seo/public-site-seo-spec.md");

describe("MPReply authoritative product documentation", () => {
  it("uses MPReply and the four-marketplace product truth", () => {
    expect(product).toContain("# MPReply");
    for (const marketplace of ["Wildberries", "Ozon", "Yandex Market", "Avito"]) {
      expect(product).toContain(marketplace);
    }
    expect(product).toContain("release certification");
    expect(product).not.toContain("Wildberries: current MVP adapter");
  });

  it("defines the approved blue design direction and dashboard UX", () => {
    expect(design).toContain("# MPReply");
    expect(design).toContain("#2563EB");
    expect(design).toContain("112–160px");
    expect(design).toContain("What needs attention");
    expect(design).not.toContain("Primary violet: `#6F33AB`");
    expect(design).not.toContain("Impeccable contract");
  });

  it("keeps agent instructions objective and current", () => {
    expect(agents).toContain("MPReply");
    expect(agents).toContain("npm run test:visual");
    expect(agents).not.toContain("npm run design:detect");
    expect(agents).not.toContain("# Respio Agent Instructions");
  });

  it("aligns public marketing and SEO briefs to competitor-informed MPReply copy", () => {
    expect(publicBrief).toContain("MPReply");
    expect(publicBrief).toContain("competitor");
    expect(publicBrief).toContain("автоматически или после проверки");
    expect(seo).toContain("MPReply");
    expect(seo).toContain("автоответы на отзывы");
    expect(seo).toContain("сообщения покупателей");
    expect(seo).toContain("Авито");
  });
});
