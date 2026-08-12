import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const home = read("app/page.tsx");
const hero = read("components/public-site/HeroProductFlowCanvas.tsx");
const heroCss = read("components/public-site/HeroProductFlowCanvas.module.css");
const globals = read("styles/globals.css");
const design = read("../../DESIGN.md");
const product = read("../../PRODUCT.md");
const brief = read("../../docs/product/public-site-master-brief.md");

describe("public-site design closure", () => {
  it("uses only the Product Pipeline Hero on the homepage", () => {
    expect(home).toContain("HeroProductFlowCanvas");
    expect(home).not.toContain("HeroFlowCanvas");
  });

  it("models question, product, seller rules, processing and answer as explicit Hero roles", () => {
    for (const role of ["question", "product", "rules", "engine", "answer"]) {
      expect(hero).toContain(`data-flow-role="${role}"`);
    }
  });

  it("keeps seller rules concise and the answer as the endpoint", () => {
    expect(hero).toContain("Правила продавца");
    expect(hero).toContain("Без неподтверждённых обещаний");
    expect(hero).toContain("Только по данным");
    expect(hero).toContain("Ответ готов к публикации");
    expect(hero).toContain("04 · Готовый ответ");
    expect(hero).not.toContain("95%");
    expect(heroCss).toContain(".rulesCard");
    expect(heroCss).toContain(".answerCard");
  });

  it("pauses ambient Hero animation outside the visible page lifecycle", () => {
    expect(hero).toContain("IntersectionObserver");
    expect(hero).toContain('document.addEventListener("visibilitychange"');
    expect(hero).toContain("prefers-reduced-motion: reduce");
    expect(hero).toContain('matchMedia("(max-width: 1240px)")');
    expect(hero).toContain("!compactLayout");
    expect(hero).toContain("compactLayoutQuery.removeEventListener");
    expect(hero).toContain('scene.dataset.animation = "running"');
    expect(hero).toContain('scene.dataset.animation = "stopped"');
  });

  it("keeps the Product Pipeline lightweight", () => {
    expect(hero).not.toContain("THREE");
    expect(hero).not.toContain("WebGL");
    expect(heroCss).not.toContain("transition: all");
  });

  it("ships no rejected orbital Hero implementation", () => {
    for (const path of [
      "components/public-site/HeroFlowCanvas.tsx",
      "components/public-site/HeroFlowCanvas.module.css",
      "components/public-site/HeroFlowModel.ts",
      "components/public-site/HeroFlowWebGL.ts",
      "styles/hero-canvas-recovery.css",
    ]) {
      expect(existsSync(resolve(process.cwd(), path))).toBe(false);
    }
    expect(globals).not.toContain("hero-canvas-recovery.css");
  });

  it("makes Product Pipeline the current documentation authority", () => {
    expect(design).toContain("Product Pipeline");
    expect(brief).toContain("Product Pipeline");
    expect(design).toContain("orbital/WebGL Hero is rejected");
    expect(product).toContain("Product Pipeline");
    expect(product).toContain("historical and rejected");
    expect(product).not.toContain("0.1.32 authoritative Hero state");
  });

  it("surfaces practical resources in the homepage story", () => {
    expect(home).toContain('href="/resources"');
    expect(home).toContain("home-resources");
  });
});
