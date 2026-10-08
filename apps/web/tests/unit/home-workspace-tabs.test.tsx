import { fireEvent, render, screen, within } from "@testing-library/react";
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

  it("keeps every tab connected to the rendered tabpanel", () => {
    render(<HomeWorkspaceTabs />);

    const panel = screen.getByRole("tabpanel");
    const panelId = panel.getAttribute("id");
    expect(panelId).toBeTruthy();

    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveAttribute("aria-controls", panelId);
    }
  });

  it("keeps filters and preview rows aligned with the selected request type", () => {
    render(<HomeWorkspaceTabs />);

    expect(screen.getByText("Все отзывы")).toBeInTheDocument();
    expect(screen.getByText("Покупатель оценил качество и доставку товара")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Вопросы/ }));

    const questionFilters = screen.getByLabelText("Фильтры обращений");
    expect(within(questionFilters).getByText("Все вопросы")).toBeInTheDocument();
    expect(screen.getByText("Подойдёт ли размер M на рост 178 см?")).toBeInTheDocument();
    expect(screen.queryByText("Покупатель оценил качество и доставку товара")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Сообщения/ }));

    const messageFilters = screen.getByLabelText("Фильтры обращений");
    expect(within(messageFilters).getByText("Все сообщения")).toBeInTheDocument();
    expect(screen.getByText("Когда сможете отправить заказ?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Все обращения/ }));

    const allFilters = screen.getByLabelText("Фильтры обращений");
    expect(within(allFilters).getByText("Все обращения", { selector: "b" })).toBeInTheDocument();
    expect(within(allFilters).getByText("Отзывы")).toBeInTheDocument();
    expect(within(allFilters).getByText("Вопросы")).toBeInTheDocument();
    expect(within(allFilters).getByText("Сообщения")).toBeInTheDocument();
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
