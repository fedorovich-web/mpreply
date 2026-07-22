import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const heroSource = readFileSync(
  resolve(process.cwd(), "components/public-site/HeroProductFlowCanvas.tsx"),
  "utf8",
);

const heroStyles = readFileSync(
  resolve(process.cwd(), "components/public-site/HeroProductFlowCanvas.module.css"),
  "utf8",
);

describe("MPReply hero product flow visual contract", () => {
  it("preserves the approved v50 product-answer scenario and WebP product asset", () => {
    expect(heroSource).toContain("На широкую стопу подойдёт?");
    expect(heroSource).toContain("Кроссовки для ходьбы");
    expect(heroSource).toContain("Лучше взять 41 размер.");
    expect(heroSource).toContain("/brand/mpreply-hero-sneakers.webp");
    expect(heroSource).not.toContain("SKU 41852");
    expect(heroSource).not.toContain("Фильтр HEPA Pro");
  });

  it("keeps the approved light canvas scene and animated connection graph", () => {
    expect(heroSource).toContain("drawConnection(");
    expect(heroSource).toContain("drawScene(");
    expect(heroSource).toContain("closest<HTMLElement>(\".home-hero\")");
    expect(heroSource).toContain("--q-x");
    expect(heroSource).toContain("--e-x");
    expect(heroStyles).not.toContain("linear-gradient(rgb(86 105 152 / 5%) 1px, transparent 1px)");
    expect(heroStyles).toContain("background: radial-gradient(circle at var(--spot-x) var(--spot-y)");
    expect(heroStyles).toContain("transform: translate3d(var(--q-x), var(--q-y), 0)");
    expect(heroStyles).toContain("transform: translate3d(var(--a-x), var(--a-y), 0)");
  });
});
