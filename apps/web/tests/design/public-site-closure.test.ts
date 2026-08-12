import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const home = read("app/page.tsx");
const hero = read("components/public-site/HeroProductFlowCanvas.tsx");
const heroCss = read("components/public-site/HeroProductFlowCanvas.module.css");
const design = read("../../DESIGN.md");
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

  it("pauses ambient Hero animation outside the visible page lifecycle", () => {
    expect(hero).toContain("IntersectionObserver");
    expect(hero).toContain('document.addEventListener("visibilitychange"');
    expect(hero).toContain("prefers-reduced-motion: reduce");
  });

  it("keeps the Product Pipeline lightweight", () => {
    expect(hero).not.toContain("THREE");
    expect(hero).not.toContain("WebGL");
    expect(heroCss).not.toContain("transition: all");
  });

  it("makes Product Pipeline the current documentation authority", () => {
    expect(design).toContain("Product Pipeline");
    expect(brief).toContain("Product Pipeline");
    expect(design).toContain("orbital/WebGL Hero is rejected");
  });

  it("surfaces practical resources in the homepage story", () => {
    expect(home).toContain('href="/resources"');
    expect(home).toContain("home-resources");
  });
});
