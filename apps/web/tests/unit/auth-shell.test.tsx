import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthShell } from "../../components/auth/AuthShell";

describe("AuthShell", () => {
  it("shows the current MPReply marketplace workflow beside the auth content", () => {
    render(
      <AuthShell
        description="Продолжите работу с отзывами и сообщениями покупателей."
        eyebrow="Аккаунт MPReply"
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
    expect(screen.getByRole("link", { name: "MPReply — на главную" })).toHaveAttribute("href", "/");
    expect(screen.getByText(/Wildberries, Ozon, Яндекс Маркета и Авито/)).toBeInTheDocument();
    expect(screen.queryByText(/Respio/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\b\d+%\b/)).not.toBeInTheDocument();
  });

});
