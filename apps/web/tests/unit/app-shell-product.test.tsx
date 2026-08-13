import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "../../components/app-shell/AppShell";
import { useWorkspace } from "../../components/workspace/WorkspaceProvider";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/dashboard",
}));

vi.mock("../../components/workspace/WorkspaceProvider", () => ({
  useWorkspace: vi.fn(),
}));

const mockedUseWorkspace = vi.mocked(useWorkspace);

afterEach(() => {
  document.body.style.overflow = "";
});

function renderShell() {
  mockedUseWorkspace.mockReturnValue({
    user: {
      id: "22222222-2222-4222-8222-222222222222",
      email: "owner@example.com",
      name: "Владелец",
      status: "active",
      is_superadmin: false,
      created_at: "2026-08-13T08:00:00Z",
      updated_at: "2026-08-13T08:00:00Z",
    },
    organizations: [{
      id: "11111111-1111-4111-8111-111111111111",
      name: "Основной кабинет",
      slug: "main",
      owner_user_id: "22222222-2222-4222-8222-222222222222",
      plan_id: null,
      default_response_mode: "auto",
      status: "active",
      current_user_role: "owner",
      created_at: "2026-08-13T08:00:00Z",
      updated_at: "2026-08-13T08:00:00Z",
    }],
    activeOrganization: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Основной кабинет",
      slug: "main",
      owner_user_id: "22222222-2222-4222-8222-222222222222",
      plan_id: null,
      default_response_mode: "auto",
      status: "active",
      current_user_role: "owner",
      created_at: "2026-08-13T08:00:00Z",
      updated_at: "2026-08-13T08:00:00Z",
    },
    setActiveOrganizationId: vi.fn(),
    logout: vi.fn(async () => undefined),
    isLoggingOut: false,
  });

  render(<AppShell><div>Контент</div></AppShell>);
}

describe("AppShell customer product navigation", () => {
  it("groups complete customer routes and hides implementation-stage language", () => {
    renderShell();

    for (const label of [
      "Сводка",
      "Отзывы, вопросы и чаты",
      "Ответы на проверке",
      "Правила автоответов",
      "Стиль ответов",
      "Данные для ответов",
      "Подключённые кабинеты",
      "Статистика ответов",
      "Сотрудники",
      "Настройки",
      "Тариф",
      "История изменений",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }

    expect(screen.queryByRole("navigation", { name: "Работа" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Ежедневная работа" })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Основные разделы" })).toBeInTheDocument();
    for (const group of ["Настройка ответов", "Маркетплейсы", "Отчёты", "Компания"]) {
      expect(screen.getByRole("navigation", { name: group })).toBeInTheDocument();
    }

    for (const internalCopy of ["OpenRouter", "MVP adapter", "Следующие спринты", "Seller AI ops", "Auto-first workspace"]) {
      expect(screen.queryByText(internalCopy)).not.toBeInTheDocument();
    }
  });

  it("closes the mobile drawer with Escape and restores focus and body scrolling", () => {
    renderShell();
    const trigger = screen.getByRole("button", { name: "Открыть навигацию" });

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByRole("button", { name: "Закрыть навигацию" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
    expect(trigger).toHaveFocus();
  });

  it("closes the mobile drawer from the backdrop", () => {
    renderShell();
    const trigger = screen.getByRole("button", { name: "Открыть навигацию" });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Закрыть навигацию" }));

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
  });
});
