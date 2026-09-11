import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthShell } from "../../components/auth/AuthShell";

describe("AuthShell", () => {
  it("shows an MPReply product preview beside the auth content", () => {
    render(
      <AuthShell
        description="Продолжите работу с отзывами и сообщениями покупателей."
        eyebrow="MPReply account"
        title="Вход"
      >
        <div>Форма входа</div>
      </AuthShell>,
    );

    expect(screen.getByRole("heading", { name: "Вход" })).toBeInTheDocument();
    expect(screen.getByText("Форма входа")).toBeInTheDocument();
    expect(screen.getByLabelText("Превью интерфейса MPReply")).toBeInTheDocument();
    expect(screen.getByText("Единая очередь")).toBeInTheDocument();
    expect(screen.getByText("AI-черновик готов")).toBeInTheDocument();
    expect(screen.getByText("Wildberries")).toBeInTheDocument();
    expect(screen.getByText("Ozon")).toBeInTheDocument();
    expect(screen.getByText("Яндекс Маркет")).toBeInTheDocument();
  });

  it("offers only the planned Yandex social entry point", () => {
    render(
      <AuthShell
        description="Создайте аккаунт."
        eyebrow="MPReply account"
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
