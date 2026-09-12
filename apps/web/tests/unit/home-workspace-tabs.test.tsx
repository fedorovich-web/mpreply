import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeWorkspaceTabs } from "../../components/public-site/HomeWorkspaceTabs";

describe("HomeWorkspaceTabs", () => {
  it("shows reviews first and switches the workspace preview with accessible tabs", () => {
    render(<HomeWorkspaceTabs />);

    const reviewsTab = screen.getByRole("tab", { name: "Отзывы" });
    const questionsTab = screen.getByRole("tab", { name: "Вопросы" });
    const messagesTab = screen.getByRole("tab", { name: "Сообщения" });

    expect(reviewsTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { level: 3, name: "Отзыв о товаре" })).toBeInTheDocument();

    fireEvent.click(questionsTab);
    expect(questionsTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { level: 3, name: "Вопрос покупателя" })).toBeInTheDocument();

    fireEvent.click(messagesTab);
    expect(messagesTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { level: 3, name: "Диалог с покупателем" })).toBeInTheDocument();
  });
});
