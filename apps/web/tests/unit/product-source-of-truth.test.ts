import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(process.cwd(), "..", "..");
const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");

const product = read("PRODUCT.md");
const design = read("DESIGN.md");
const agents = read("AGENTS.md");
const readme = read("README.md");
const englishReadme = read("README.en.md");
const publicBrief = read("docs/product/public-site-master-brief.md");
const seo = read("docs/seo/public-site-seo-spec.md");
const adr = read("docs/adr/0008-public-site-seo-legal-foundation.md");

describe("MPReply authoritative product documentation", () => {
  it("uses MPReply and the four-marketplace product truth", () => {
    expect(product).toContain("# MPReply");
    expect(readme).toContain("# MPReply");
    expect(englishReadme).toContain("# MPReply");
    for (const marketplace of ["Wildberries", "Ozon", "Yandex Market", "Avito"]) {
      expect(product).toContain(marketplace);
      expect(englishReadme).toContain(marketplace);
    }
    for (const marketplace of ["Wildberries", "Ozon", "Яндекс Маркет", "Авито"]) {
      expect(readme).toContain(marketplace);
    }
    expect(product).toContain("release certification");
    expect(product).not.toContain("Wildberries: current MVP adapter");
    expect(readme).not.toContain("Wildberries is the current MVP marketplace integration");
    expect(adr).toContain("Wildberries, Ozon, Yandex Market and Avito");
    expect(adr).not.toMatch(/roadmap\/planned|not represented as production-ready/i);
  });

  it("defines the approved MPReply brand direction and dashboard UX", () => {
    expect(design).toContain("#0B68F6");
    expect(design).toContain("#0757D7");
    expect(design).toContain("#0649B8");
    expect(design).toContain("linear-gradient(110deg, #0D6CF7 0%, #0674FF 58%, #0A5FE8 100%)");
    expect(design).toContain("112–160px");
    expect(design).toContain("What needs attention");
    expect(design).toContain("render spacing + 15px");
    expect(design).not.toContain("#2563EB");
    expect(design).not.toContain("/resources");
    expect(design).not.toContain("Primary violet: `#6F33AB`");
    expect(design).not.toContain("Impeccable contract");
  });

  it("keeps the approved public route and tariff presentation authoritative", () => {
    for (const source of [product, publicBrief, seo]) {
      expect(source).toContain("/help");
      expect(source).not.toMatch(/^\| `\/resources` \|/m);
    }
    expect(existsSync(join(repoRoot, "apps/web/app/resources/page.tsx"))).toBe(false);

    for (const approvedCommercialFact of ["1 290 ₽", "3 490 ₽", "6 990 ₽", "20%", "14 дней", "350 ИИ-ответов"]) {
      expect(product).toContain(approvedCommercialFact);
      expect(publicBrief).toContain(approvedCommercialFact);
    }

    expect(seo).toContain("1 290 ₽");
    expect(seo).toContain("14 дней");
  });

  it("keeps agent instructions objective and current", () => {
    expect(agents).toContain("MPReply");
    expect(agents).toContain("npm run test:visual");
    expect(agents).toContain("production domain");
    expect(agents).toContain("Do not redesign billing or payment-provider UX in this branch");
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
