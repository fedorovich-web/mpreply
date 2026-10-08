import { describe, expect, it } from "vitest";
import { getHelpContent } from "../../lib/help-content";

describe("FAQ content integrity", () => {
  for (const locale of ["ru", "en"] as const) {
    it(`every ${locale} category points to an existing question and local route`, () => {
      const { categories, questions } = getHelpContent(locale);
      const ids = questions.map((question) => question.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const category of categories) {
        expect(category.questions.length).toBeGreaterThan(0);
        for (const id of category.questions) expect(ids).toContain(id);
      }
      for (const question of questions) {
        expect(question.question).toBeTruthy();
        expect(question.answer).toBeTruthy();
        if (question.link) expect(question.link.href).toMatch(/^\/(pricing|marketplaces|demo|contacts)$/);
      }
    });
  }
  it("translated categories preserve the same question selection", () => {
    expect(getHelpContent("en").categories.map(({ id, questions }) => ({ id, questions })))
      .toEqual(getHelpContent("ru").categories.map(({ id, questions }) => ({ id, questions })));
  });
});
