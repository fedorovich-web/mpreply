import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DemoEntry } from "../../components/public-site/DemoEntry";
import { authSessionSchema } from "../../lib/api/schemas";

const mocks = vi.hoisted(() => ({ request: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("../../lib/api/client", () => ({ apiRequest: mocks.request }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));

beforeEach(() => {
  mocks.request.mockReset();
  mocks.replace.mockReset();
  mocks.refresh.mockReset();
});
afterEach(cleanup);

describe("public demo workspace contract", () => {
  it.each(["ru", "en"] as const)("opens the real localized workspace after the demo session succeeds (%s)", async (locale) => {
    mocks.request.mockResolvedValue({});
    render(createElement(DemoEntry, { locale }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(locale === "en" ? "/en/app/dashboard" : "/app/dashboard"));
    expect(mocks.request).toHaveBeenCalledExactlyOnceWith("/api/auth/demo", authSessionSchema, { method: "POST" });
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(locale === "ru" ? "демо-кабинет MPReply" : "MPReply demo workspace");
    expect(screen.getByText(locale === "ru" ? /Доступ только для просмотра/ : /Access is view-only/)).toBeVisible();
  });

  it("shows a recoverable error without redirecting into an unauthenticated workspace", async () => {
    mocks.request.mockRejectedValueOnce(new Error("Unavailable"));
    render(createElement(DemoEntry, { locale: "ru" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось открыть демо-кабинет");
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    mocks.request.mockResolvedValueOnce({});
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/app/dashboard"));
    expect(mocks.request).toHaveBeenCalledTimes(2);
  });

  it("explains the demo restrictions before entry instead of offering external writes", () => {
    mocks.request.mockImplementation(() => new Promise(() => {}));
    render(createElement(DemoEntry, { locale: "ru" }));
    expect(screen.getByText(/добавить ключи, изменить данные или отправить ответ нельзя/)).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Подготавливаем демо-кабинет");
    expect(screen.queryByRole("button", { name: /отправить|сохранить|подключить/i })).not.toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("routes both public demo pages through DemoEntry and keeps them non-indexable", () => {
    for (const locale of ["ru", "en"] as const) {
      const path = locale === "ru" ? "app/demo/page.tsx" : "app/en/demo/page.tsx";
      const source = readFileSync(join(process.cwd(), path), "utf8");
      expect(source).toContain(`<DemoEntry locale="${locale}" />`);
      expect(source).toContain("index: false");
      expect(source).not.toMatch(/demo-journey|demo-scenarios|Ответ успешно отправлен/);
    }
  });
});
