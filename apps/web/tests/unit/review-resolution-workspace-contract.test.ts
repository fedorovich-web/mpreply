import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const componentSource = readFileSync(
  resolve(process.cwd(), "components/public-site/ReviewResolutionWorkspace.tsx"),
  "utf8",
);

const stylesSource = readFileSync(
  resolve(process.cwd(), "components/public-site/ReviewResolutionWorkspace.module.css"),
  "utf8",
);

const pageSource = readFileSync(resolve(process.cwd(), "app/page.tsx"), "utf8");

describe("Review Resolution Workspace contract", () => {
  it("keeps the accepted compact three-column resolution workspace", () => {
    expect(componentSource).not.toContain("Review Resolution Workspace");
    expect(componentSource).toContain("01 · Диагностика и проверка");
    expect(componentSource).toContain("02 · Персональный ответ и решение");
    expect(componentSource).toContain("Что определил MPReply");
    expect(stylesSource).toContain(
      "grid-template-columns: minmax(17rem, 0.74fr) minmax(20rem, 0.9fr) minmax(25rem, 1.08fr)",
    );
  });

  it("supports the accepted positive, neutral and negative tabs", () => {
    expect(componentSource).toContain('tab: "Положительный"');
    expect(componentSource).toContain('tab: "Нейтральный"');
    expect(componentSource).toContain('tab: "Негативный"');
    expect(componentSource).toContain('useState<ScenarioKey>("positive")');
    expect(componentSource).toContain('role="tablist"');
    expect(componentSource).toContain('role="tabpanel"');
  });

  it("uses the approved heading and remains responsive", () => {
    expect(pageSource).toContain(
      "MPReply готовит точный ответ и выбирает действие по правилам",
    );
    expect(pageSource).toContain("<ReviewResolutionWorkspace />");
    expect(stylesSource).toContain("@media (max-width: 1180px)");
    expect(stylesSource).toContain("@media (max-width: 680px)");
  });
});
