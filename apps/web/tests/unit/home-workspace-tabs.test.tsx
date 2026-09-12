import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeWorkspaceTabs } from "../../components/public-site/HomeWorkspaceTabs";

describe("HomeWorkspaceTabs", () => {
  it("shows the approved four-tab workspace and switches AI answer context", () => {
    render(<HomeWorkspaceTabs />);

    const reviewsTab = screen.getByRole("tab", { name: /Отзывы/ });
    const questionsTab = screen.getByRole("tab", { name: /Вопросы/ });
    const messagesTab = screen.getByRole("tab", { name: /Сообщения/ });
    const allTab = screen.getByRole("tab", { name: /Все обращения/ });

    expect(reviewsTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/Спасибо за ваш отзыв/)).toBeInTheDocument();

    fireEvent.click(questionsTab);
    expect(questionsTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/Спасибо за вопрос/)).toBeInTheDocument();

    fireEvent.click(messagesTab);
    expect(messagesTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/Сообщение получено/)).toBeInTheDocument();

    fireEvent.click(allTab);
    expect(allTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/объединяет отзывы, вопросы и сообщения/)).toBeInTheDocument();
  });

  it("supports ArrowLeft, ArrowRight, Home and End keyboard navigation", () => {
    render(<HomeWorkspaceTabs />);

    const reviewsTab = screen.getByRole("tab", { name: /Отзывы/ });
    const questionsTab = screen.getByRole("tab", { name: /Вопросы/ });
    const allTab = screen.getByRole("tab", { name: /Все обращения/ });

    reviewsTab.focus();
    fireEvent.keyDown(reviewsTab, { key: "ArrowRight" });
    expect(questionsTab).toHaveFocus();
    expect(questionsTab).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(questionsTab, { key: "End" });
    expect(allTab).toHaveFocus();
    expect(allTab).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(allTab, { key: "ArrowRight" });
    expect(reviewsTab).toHaveFocus();
    expect(reviewsTab).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(reviewsTab, { key: "ArrowLeft" });
    expect(allTab).toHaveFocus();
    expect(allTab).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(allTab, { key: "Home" });
    expect(reviewsTab).toHaveFocus();
    expect(reviewsTab).toHaveAttribute("aria-selected", "true");
  });
});
