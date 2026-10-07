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
  it.each([HomePage, EnglishHomePage])("describes implemented context without claiming unavailable provider routing", async (Page) => {
    const document = new DOMParser().parseFromString(await renderServer(createElement(Page)), "text/html");
    const section = document.querySelector(".homepage-models-section");
    expect(section?.textContent).not.toMatch(/GPT 6|Claude Sonnet 5\.5|Gemini 3\.8|DeepSeek V4\.1 Flash/);
    expect(section?.querySelectorAll(".homepage-model-card")).toHaveLength(4);
    expect(section?.querySelector("a")?.getAttribute("href")).toMatch(/\/features$/);
  });
});
