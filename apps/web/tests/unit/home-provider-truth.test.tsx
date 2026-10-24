import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import HomePage from "../../app/page";
import EnglishHomePage from "../../app/en/page";
import { renderServer } from "../helpers/render-server";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-nonce": "test-nonce" }) }));

describe("homepage capability truth", () => {
  it.each([HomePage, EnglishHomePage])("keeps the approved journey connected with four ordered stages", async (Page) => {
    const document = new DOMParser().parseFromString(await renderServer(createElement(Page)), "text/html");
    const journey = document.querySelector("ol.homepage-horizontal-process");
    expect(Array.from(journey?.querySelectorAll(".homepage-process-number-circle") ?? [], (marker) => marker.textContent)).toEqual(["1", "2", "3", "4"]);
    expect(document.querySelector(".homepage-process-visual svg.homepage-process-path path")).not.toBeNull();
  });
  it.each([HomePage, EnglishHomePage])("preserves the owner's four model cards, source logos and concise descriptions", async (Page) => {
    const document = new DOMParser().parseFromString(await renderServer(createElement(Page)), "text/html");
    const section = document.querySelector(".homepage-models-section");
    const cards = Array.from(section?.querySelectorAll(".homepage-model-card") ?? []);
    expect(cards.map((card) => card.querySelector("strong")?.textContent)).toEqual([
      "GPT-6 Luna", "Claude Sonnet 5.5", "Gemini 3.8", "DeepSeek V4.1",
    ]);
    expect(cards.map((card) => card.querySelector("img")?.getAttribute("src"))).toEqual([
      "/images/brands/chatgpt-sign-logo.svg", "/images/brands/claude-icon-logo.svg",
      "/images/brands/gemini.svg", "/images/brands/deepseek-sign-logo.svg",
    ]);
    for (const card of cards) {
      expect(card.querySelector(".homepage-model-description")?.textContent?.trim().length).toBeGreaterThan(30);
      expect(card.querySelector("img")?.getAttribute("alt")).toBe("");
    }
    expect(section?.textContent).not.toMatch(/Контекст и контроль|Context and controls/);
  });
});
