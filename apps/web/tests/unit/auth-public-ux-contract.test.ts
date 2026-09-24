import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const form = readFileSync(join(root, "components/auth/AuthForm.tsx"), "utf8");
const styles = readFileSync(join(root, "styles/auth.css"), "utf8");

describe("auth public UX", () => {
  it("keeps login and registration on the real auth API with safe redirect handling", () => {
    expect(form).toContain('apiRequest(`/api/auth/${mode}`');
    expect(form).toContain('const appPrefix = locale === "en" ? "/en/app/" : "/app/"');
    expect(form).toContain("requestedNext?.startsWith(appPrefix)");
    expect(form).toContain('intent === "connect-marketplace"');
  });

  it("uses the canonical MPReply mark instead of a hand-written auth glyph", () => {
    expect(form).toContain('import { PublicBrandMark } from "../public-site/PublicBrandMark"');
    expect(form.match(/<PublicBrandMark \/>/g) ?? []).toHaveLength(2);
    expect(form).not.toContain('className="public-brand-mark" aria-hidden="true">M');
  });

  it("translates auth failures into user-facing messages instead of exposing backend detail", () => {
    expect(form).toContain("function authErrorMessage");
    expect(form).toContain("Неверный email или пароль");
    expect(form).toContain("Аккаунт с таким email уже существует");
    expect(form).not.toContain("mutation.error instanceof ApiError ? mutation.error.message");
  });

  it("keeps the responsive split auth composition", () => {
    expect(form).toContain("auth-product-panel");
    expect(form).toContain("auth-form-panel");
    expect(styles).toContain(".auth-shell");
    expect(styles).toContain("@media (max-width: 1080px)");
    expect(styles).toContain("@media (max-width: 560px)");
  });
});
