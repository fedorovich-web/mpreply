import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ContactMailForm } from "../../components/public-site/ContactMailForm";
import { apiRequest } from "../../lib/api/client";

vi.mock("../../lib/api/client", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../lib/api/client")>(),
  apiRequest: vi.fn(),
}));

const mockedApiRequest = vi.mocked(apiRequest);

function completeForm() {
  fireEvent.change(screen.getByLabelText("Ваше имя *"), { target: { value: "Анна" } });
  fireEvent.change(screen.getByLabelText("Рабочая почта *"), { target: { value: "anna@example.com" } });
  fireEvent.change(screen.getByLabelText("Ваше сообщение *"), { target: { value: "Не вижу новые отзывы в очереди." } });
  fireEvent.click(screen.getByLabelText("Я согласен на обработку персональных данных"));
}

describe("ContactMailForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the completed form through the API and confirms delivery", async () => {
    mockedApiRequest.mockResolvedValue({ message: "Message sent" });
    render(<ContactMailForm supportEmail="support@mpreply.ru" />);
    completeForm();
    fireEvent.click(screen.getByRole("button", { name: "Отправить сообщение" }));

    await waitFor(() => expect(mockedApiRequest).toHaveBeenCalledTimes(1));
    expect(mockedApiRequest).toHaveBeenCalledWith(
      "/api/contact",
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({
          email: "anna@example.com",
          topic: "support",
          message: "Не вижу новые отзывы в очереди.",
          idempotency_key: expect.any(String),
          consent: true,
        }),
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Сообщение отправлено.");
    expect(screen.queryByText(/почтовое приложение/)).not.toBeInTheDocument();
  });

  it("shows an error and a direct contact link when delivery fails", async () => {
    mockedApiRequest.mockRejectedValue(new Error("delivery failed"));
    render(<ContactMailForm supportEmail="support@mpreply.ru" />);
    completeForm();
    fireEvent.click(screen.getByRole("button", { name: "Отправить сообщение" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось отправить сообщение.");
    expect(screen.getByRole("link", { name: "support@mpreply.ru" })).toHaveAttribute("href", "mailto:support@mpreply.ru");
  });

  it("keeps the same request key on a retry and changes it when the message changes", async () => {
    mockedApiRequest.mockRejectedValue(new Error("delivery failed"));
    render(<ContactMailForm supportEmail="support@mpreply.ru" />);
    completeForm();
    const send = screen.getByRole("button", { name: "Отправить сообщение" });
    fireEvent.click(send);
    await screen.findByRole("alert");
    const first = mockedApiRequest.mock.calls[0][2]?.body as { idempotency_key: string };
    fireEvent.click(send);
    await waitFor(() => expect(send).toBeEnabled());
    const retry = mockedApiRequest.mock.calls[1][2]?.body as { idempotency_key: string };
    expect(retry.idempotency_key).toBe(first.idempotency_key);
    fireEvent.change(screen.getByLabelText("Ваше сообщение *"), { target: { value: "Обновлённый вопрос: как подключить ещё один магазин?" } });
    fireEvent.click(send);
    await waitFor(() => expect(send).toBeEnabled());
    const edited = mockedApiRequest.mock.calls[2][2]?.body as { idempotency_key: string };
    expect(edited.idempotency_key).not.toBe(first.idempotency_key);
  });

  it("does not send trimmed invalid input", async () => {
    render(<ContactMailForm supportEmail="support@mpreply.ru" />);
    completeForm();
    fireEvent.change(screen.getByLabelText("Ваше имя *"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Отправить сообщение" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Проверьте поля");
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  it("prevents duplicate submissions while waiting for the server", async () => {
    let complete!: (value: unknown) => void;
    mockedApiRequest.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    render(<ContactMailForm supportEmail="support@mpreply.ru" />);
    completeForm();
    const form = screen.getByRole("button", { name: "Отправить сообщение" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(mockedApiRequest).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Отправляем…" })).toBeDisabled();
    complete({ message: "Message sent" });
    await screen.findByRole("status");
  });
});
