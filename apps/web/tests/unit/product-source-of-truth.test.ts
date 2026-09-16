import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(process.cwd(), "..", "..");
const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");

const product = read("PRODUCT.md");
const design = read("DESIGN.md");
const agents = read("AGENTS.md");
const readme = read("README.md");
const publicBrief = read("docs/product/public-site-master-brief.md");
const seo = read("docs/seo/public-site-seo-spec.md");
const adr = read("docs/adr/0008-public-site-seo-legal-foundation.md");

describe("MPReply authoritative product documentation", () => {
  it("uses MPReply and the four-marketplace product truth", () => {
    expect(product).toContain("# MPReply");
    expect(readme).toContain("# MPReply");
    for (const marketplace of ["Wildberries", "Ozon", "Yandex Market", "Avito"]) {
      expect(product).toContain(marketplace);
      expect(readme).toContain(marketplace);
    }
    expect(product).toContain("release certification");
    expect(product).not.toContain("Wildberries: current MVP adapter");
    expect(readme).not.toContain("Wildberries is the current MVP marketplace integration");
    expect(adr).toContain("Wildberries, Ozon, Yandex Market and Avito");
    expect(adr).not.toMatch(/roadmap\/planned|not represented as production-ready/i);
  });

  it("defines the approved MPReply brand direction and dashboard UX", () => {
    expect(design).toContain("#5148E8");
    expect(design).toContain("#635BFF");
    expect(design).toContain("#5964FF");
    expect(design).toContain("linear-gradient(110deg, #5148E8 0%, #635BFF 58%, #5964FF 100%)");
    expect(design).toContain("112–160px");
    expect(design).toContain("What needs attention");
    expect(design).toContain("render spacing + 15px");
    expect(design).not.toContain("#2563EB");
    expect(design).not.toContain("/resources");
    expect(design).not.toContain("Primary violet: `#6F33AB`");
    expect(design).not.toContain("Impeccable contract");
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
