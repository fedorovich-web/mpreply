import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthShell } from "../../components/auth/AuthShell";

describe("AuthShell", () => {
  it("shows a truthful Respio workflow beside the auth content", () => {
    render(
      <AuthShell
        description="Продолжите работу с отзывами и сообщениями покупателей."
        eyebrow="Аккаунт Respio"
        title="Вход"
      >
        <div>Форма входа</div>
      </AuthShell>,
    );

    expect(screen.getByRole("heading", { name: "Вход" })).toBeInTheDocument();
    expect(screen.getByText("Форма входа")).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", {
        name: "Автоматизация с проверкой там, где она нужна",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Обращения в очереди")).toBeInTheDocument();
    expect(screen.getByText("В MVP отправка ответов поддерживается через Wildberries.")).toBeInTheDocument();
    expect(screen.queryByText("Ozon")).not.toBeInTheDocument();
    expect(screen.queryByText("Яндекс Маркет")).not.toBeInTheDocument();
    expect(screen.queryByText(/\b\d+%\b/)).not.toBeInTheDocument();
  });

  it("offers only the planned Yandex social entry point", () => {
    render(
      <AuthShell
        description="Создайте аккаунт."
        eyebrow="Аккаунт Respio"
        showYandexButton
        title="Создать аккаунт"
      >
        <div>Форма регистрации</div>
      </AuthShell>,
    );

    const yandex = screen.getByRole("button", { name: "Продолжить с Яндекс ID — скоро" });
    expect(yandex).toBeDisabled();
    expect(screen.queryByText(/Google/i)).not.toBeInTheDocument();
  });
});
