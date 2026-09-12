"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";

type WorkspaceTab = "reviews" | "questions" | "messages" | "all";

type WorkspaceState = {
  label: string;
  icon: string;
  answer: string;
  tone: string;
};

const workspaceStates: Record<WorkspaceTab, WorkspaceState> = {
  reviews: {
    label: "Отзывы",
    icon: "☆",
    answer: "Спасибо за ваш отзыв! Нам очень приятно, что товар вам понравился. Будем рады видеть вас снова!",
    tone: "green",
  },
  questions: {
    label: "Вопросы",
    icon: "◎",
    answer: "Спасибо за вопрос! Подготовили ответ с учётом карточки товара и доступной информации.",
    tone: "blue",
  },
  messages: {
    label: "Сообщения",
    icon: "▱",
    answer: "Здравствуйте! Сообщение получено. Ответ подготовлен с учётом контекста обращения.",
    tone: "cyan",
  },
  all: {
    label: "Все обращения",
    icon: "◇",
    answer: "MPReply объединяет отзывы, вопросы и сообщения в одной очереди и помогает отвечать без лишних переключений.",
    tone: "blue",
  },
};

const tabs = Object.entries(workspaceStates) as Array<[WorkspaceTab, WorkspaceState]>;
const tabOrder = tabs.map(([key]) => key);

const reviewRows = [
  { initials: "АК", name: "Анна К.", rating: "★★★★★", text: "Отличное качество, быстрая доставка!", time: "12 мин назад" },
  { initials: "ДС", name: "Дмитрий С.", rating: "★★★★★", text: "Хороший товар, из упаковки было понятно...", time: "1 час назад" },
  { initials: "ЕМ", name: "Елена М.", rating: "★★★★☆", text: "Цвет немного отличается от фото", time: "3 часа назад" },
  { initials: "СВ", name: "Сергей В.", rating: "★★★★★", text: "Отличный продавец, рекомендую!", time: "5 часов назад" },
] as const;

export function HomeWorkspaceTabs() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("reviews");
  const id = useId();
  const tabRefs = useRef<Partial<Record<WorkspaceTab, HTMLButtonElement | null>>>({});
  const active = workspaceStates[activeTab];

  const activateAndFocus = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    tabRefs.current[tab]?.focus();
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, key: WorkspaceTab) => {
    const currentIndex = tabOrder.indexOf(key);
    let target: WorkspaceTab | null = null;

    if (event.key === "ArrowRight") target = tabOrder[(currentIndex + 1) % tabOrder.length];
    if (event.key === "ArrowLeft") target = tabOrder[(currentIndex - 1 + tabOrder.length) % tabOrder.length];
    if (event.key === "Home") target = tabOrder[0];
    if (event.key === "End") target = tabOrder[tabOrder.length - 1];
    if (!target) return;

    event.preventDefault();
    activateAndFocus(target);
  };

  return (
    <div className="homepage-workspace homepage-approved-workspace">
      <div className="homepage-workspace-tabs" role="tablist" aria-label="Тип обращения">
        {tabs.map(([key, item]) => {
          const selected = key === activeTab;
          return (
            <button
              key={key}
              id={`${id}-${key}-tab`}
              className="homepage-workspace-tab"
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${id}-${key}-panel`}
              tabIndex={selected ? 0 : -1}
              ref={(node) => {
                tabRefs.current[key] = node;
              }}
              onClick={() => setActiveTab(key)}
              onKeyDown={(event) => handleTabKeyDown(event, key)}
            >
              <span aria-hidden="true">{item.icon}</span>{item.label}
            </button>
          );
        })}
      </div>

      <div
        id={`${id}-${activeTab}-panel`}
        className="homepage-workspace-panel"
        role="tabpanel"
        aria-labelledby={`${id}-${activeTab}-tab`}
      >
        <aside className="homepage-workspace-queue" aria-label="Фильтры обращений">
          <strong>{active.label}</strong>
          <div className="homepage-workspace-filter is-active"><span>▧</span><b>Все отзывы</b><small>56</small></div>
          <div className="homepage-workspace-filter"><span>☆</span><b>Положительные</b><small>38</small></div>
          <div className="homepage-workspace-filter"><span>○</span><b>Нейтральные</b><small>12</small></div>
          <div className="homepage-workspace-filter"><span>!</span><b>Отрицательные</b><small>6</small></div>
        </aside>

        <div className="homepage-workspace-list" role="group" aria-label="Список обращений">
          {reviewRows.map((row, index) => (
            <article className={`homepage-workspace-list-row${index === 0 ? " is-active" : ""}`} key={row.name}>
              <span className="homepage-workspace-list-avatar" aria-hidden="true">{row.initials}</span>
              <div>
                <strong>{row.name} <span>{row.rating}</span></strong>
                <p>{row.text}</p>
              </div>
              <span className="homepage-workspace-time">{row.time}</span>
            </article>
          ))}
        </div>

        <article className="homepage-workspace-answer">
          <div className="homepage-workspace-answer-head">
            <span className={`homepage-workspace-answer-dot is-${active.tone}`} aria-hidden="true" />
            <strong>Ответ с помощью ИИ</strong>
          </div>
          <p>{active.answer}</p>
          <div className="homepage-workspace-answer-actions" aria-hidden="true">
            <span>Дружелюбный⌄</span>
            <b>Отправить&nbsp; →</b>
          </div>
        </article>
      </div>
    </div>
  );
}