import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(resolve(process.cwd(), "app/page.tsx"), "utf8");
const heroSource = readFileSync(
  resolve(process.cwd(), "components/public-site/HeroProductFlowCanvas.tsx"),
  "utf8",
);
const heroStyleSource = readFileSync(
  resolve(process.cwd(), "components/public-site/HeroProductFlowCanvas.module.css"),
  "utf8",
);

describe("Respio hero product flow scene", () => {
  it("uses the accepted DOM/CSS + Canvas commerce answer pipeline", () => {
    expect(pageSource).toContain("HeroProductFlowCanvas");
    expect(pageSource).not.toContain("<HeroFlowCanvas");
    expect(heroSource).toContain('data-respio-hero="commerce-answer-pipeline"');
    expect(heroSource).toContain("Вопрос покупателя");
    expect(heroSource).toContain("Контекст товара");
    expect(heroSource).toContain("Respio Engine");
    expect(heroSource).toContain("Готовый ответ");
  });

  it("keeps readable product UI in DOM rather than drawing text into Canvas", () => {
    expect(heroSource).toContain("<canvas");
    expect(heroSource).toContain("styles.card");
    expect(heroSource).not.toContain("<article");
    expect(heroSource).not.toContain("fillText");
    expect(heroSource).not.toContain("strokeText");
    expect(heroSource).not.toContain("new THREE.WebGLRenderer");
    expect(heroSource).not.toContain("SphereGeometry");
    expect(heroSource).not.toContain("TubeGeometry");
  });

  it("draws anchored flow paths from DOM bounds instead of fixed orbital geometry", () => {
    expect(heroSource).toContain("function anchor(");
    expect(heroSource).toContain("getBoundingClientRect");
    expect(heroSource).toContain("drawConnection(");
    expect(heroSource).not.toContain("HERO_ORBITS");
    expect(heroStyleSource).not.toContain(".hero-orbit");
    expect(heroStyleSource).not.toContain("planet");
  });

  it("keeps whole-hero pointer interaction while respecting reduced motion", () => {
    expect(heroSource).toContain('closest<HTMLElement>(".home-hero")');
    expect(heroSource).toContain('hero.addEventListener("pointermove"');
    expect(heroSource).toContain('hero.addEventListener("pointerleave"');
    expect(heroSource).toContain("prefers-reduced-motion: reduce");
    expect(heroSource).toContain("--q-x");
    expect(heroSource).toContain("--a-x");
  });

  it("removes the rejected grey workspace panel and square grid from the active Hero", () => {
    expect(heroSource).not.toContain("workspaceHeader");
    expect(heroStyleSource).not.toContain(".workspace");
    expect(heroStyleSource).not.toContain("linear-gradient(rgb(86 105 152 / 5%) 1px, transparent 1px)");
    expect(heroStyleSource).toContain("border: 0");
    expect(heroStyleSource).toContain("background: radial-gradient(circle at var(--spot-x) var(--spot-y)");
  });
});
