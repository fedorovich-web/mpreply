import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const form = readFileSync(join(root, "components/auth/AuthForm.tsx"), "utf8");
const login = readFileSync(join(root, "app/en/auth/login/page.tsx"), "utf8");
const register = readFileSync(join(root, "app/en/auth/register/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/en/auth/layout.tsx"), "utf8");

describe("auth RU/EN separation", () => {
  it("renders explicit English auth routes", () => {
    expect(login).toContain('<AuthForm mode="login" locale="en" />');
    expect(register).toContain('<AuthForm mode="register" locale="en" />');
    expect(layout).toContain('index: false');
  });

  it("keeps English auth redirects inside /en/app and Russian redirects inside /app", () => {
    expect(form).toContain('const appPrefix = locale === "en" ? "/en/app/" : "/app/"');
    expect(form).toContain('const appRoot = locale === "en" ? "/en/app" : "/app"');
    expect(form).toContain("safeRequestedNext");
  });

  it("uses independent English and Russian auth copy", () => {
    expect(form).toContain('loginTitle: "Войти в MPReply"');
    expect(form).toContain('loginTitle: "Log in to MPReply"');
    expect(form).toContain('registerTitle: "Create your account"');
    expect(form).toContain("authErrorMessage(mutation.error, isLogin, locale)");
  });
});
