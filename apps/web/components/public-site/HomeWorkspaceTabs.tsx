"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";

type WorkspaceTab = "reviews" | "questions" | "messages" | "all";
type WorkspaceTone = "green" | "violet";

type WorkspaceFilter = { icon: string; label: string; count: number };
type WorkspaceRow = { initials: string; name: string; rating?: string; text: string; time: string };
type WorkspaceState = {
  label: string;
  icon: string;
  answer: string;
  tone: WorkspaceTone;
  filters: readonly WorkspaceFilter[];
  rows: readonly WorkspaceRow[];
};

const workspaceStates: Record<WorkspaceTab, WorkspaceState> = {
  reviews: {
    label: "Отзывы",
    icon: "☆",
    answer: "Спасибо за ваш отзыв! Нам очень приятно, что товар вам понравился. Будем рады видеть вас снова!",
    tone: "green",
    filters: [
      { icon: "▧", label: "Все отзывы", count: 56 },
      { icon: "☆", label: "Положительные", count: 38 },
      { icon: "○", label: "Нейтральные", count: 12 },
      { icon: "!", label: "Отрицательные", count: 6 },
    ],
    rows: [
      { initials: "АК", name: "Анна К.", rating: "★★★★★", text: "Отличное качество, быстрая доставка!", time: "12 мин назад" },
      { initials: "ДС", name: "Дмитрий С.", rating: "★★★★★", text: "Хороший товар, всё пришло аккуратно упаковано", time: "1 час назад" },
      { initials: "ЕМ", name: "Елена М.", rating: "★★★★☆", text: "Цвет немного отличается от фото", time: "3 часа назад" },
      { initials: "СВ", name: "Сергей В.", rating: "★★★★★", text: "Отличный продавец, рекомендую!", time: "5 часов назад" },
    ],
  },
  questions: {
    label: "Вопросы",
    icon: "◎",
    answer: "Спасибо за вопрос! Подготовили ответ с учётом карточки товара и доступной информации.",
    tone: "violet",
    filters: [
      { icon: "▧", label: "Все вопросы", count: 34 },
      { icon: "?", label: "Новые", count: 12 },
      { icon: "○", label: "Требуют ответа", count: 15 },
      { icon: "✓", label: "Отвечено", count: 7 },
    ],
    rows: [
      { initials: "ИС", name: "Игорь С.", text: "Подойдёт ли размер M на рост 178 см?", time: "8 мин назад" },
      { initials: "ОН", name: "Ольга Н.", text: "Есть ли инструкция на русском языке?", time: "35 мин назад" },
      { initials: "РБ", name: "Роман Б.", text: "Когда появится чёрный цвет?", time: "2 часа назад" },
      { initials: "ДК", name: "Дарья К.", text: "Можно ли использовать товар на улице?", time: "4 часа назад" },
    ],
  },
  messages: {
    label: "Сообщения",
    icon: "▱",
    answer: "Здравствуйте! Сообщение получено. Ответ подготовлен с учётом контекста обращения.",
    tone: "violet",
    filters: [
      { icon: "▧", label: "Все сообщения", count: 28 },
      { icon: "●", label: "Новые", count: 8 },
      { icon: "○", label: "В работе", count: 7 },
      { icon: "✓", label: "Закрытые", count: 13 },
    ],
    rows: [
      { initials: "АВ", name: "Алексей В.", text: "Здравствуйте! Когда сможете отправить заказ?", time: "5 мин назад" },
      { initials: "МП", name: "Мария П.", text: "Подскажите, пожалуйста, статус моего заказа", time: "24 мин назад" },
      { initials: "НК", name: "Никита К.", text: "Можно изменить адрес доставки?", time: "1 час назад" },
      { initials: "ЕА", name: "Екатерина А.", text: "Спасибо, вопрос решён", time: "3 часа назад" },
    ],
  },
  all: {
    label: "Все обращения",
    icon: "◇",
    answer: "MPReply объединяет отзывы, вопросы и сообщения в одной очереди и помогает отвечать без лишних переключений.",
    tone: "violet",
    filters: [
      { icon: "▧", label: "Все обращения", count: 118 },
      { icon: "☆", label: "Отзывы", count: 56 },
      { icon: "?", label: "Вопросы", count: 34 },
      { icon: "▱", label: "Сообщения", count: 28 },
    ],
    rows: [
      { initials: "АК", name: "Анна К.", rating: "★★★★★", text: "Отличное качество, быстрая доставка!", time: "12 мин назад" },
      { initials: "ИС", name: "Игорь С.", text: "Подойдёт ли размер M на рост 178 см?", time: "28 мин назад" },
      { initials: "МП", name: "Мария П.", text: "Подскажите, пожалуйста, статус моего заказа", time: "1 час назад" },
      { initials: "ЕМ", name: "Елена М.", rating: "★★★★☆", text: "Цвет немного отличается от фото", time: "3 часа назад" },
    ],
  },
};

const tabOrder: readonly WorkspaceTab[] = ["reviews", "questions", "messages", "all"];

export function HomeWorkspaceTabs() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("reviews");
  const id = useId();
  const tabRefs = useRef<Partial<Record<WorkspaceTab, HTMLButtonElement | null>>>({});
  const active = workspaceStates[activeTab];
  const panelId = `${id}-panel`;

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
    <div className="homepage-approved-workspace">
      <div className="homepage-workspace-tabs" role="tablist" aria-label="Тип обращения">
        {tabOrder.map((key) => {
          const item = workspaceStates[key];
          const selected = key === activeTab;
          return (
            <button key={key} id={`${id}-${key}-tab`} className="homepage-workspace-tab" type="button" role="tab" aria-selected={selected} aria-controls={panelId} tabIndex={selected ? 0 : -1} ref={(node) => { tabRefs.current[key] = node; }} onClick={() => setActiveTab(key)} onKeyDown={(event) => handleTabKeyDown(event, key)}>
              <span aria-hidden="true">{item.icon}</span>{item.label}
            </button>
          );
        })}
      </div>

      <div id={panelId} className="homepage-workspace-panel" role="tabpanel" aria-labelledby={`${id}-${activeTab}-tab`}>
        <aside className="homepage-workspace-queue" aria-label="Фильтры обращений">
          <strong>{active.label}</strong>
          {active.filters.map((filter, index) => (
            <div className={`homepage-workspace-filter${index === 0 ? " is-active" : ""}`} key={filter.label}><span aria-hidden="true">{filter.icon}</span><b>{filter.label}</b><small>{filter.count}</small></div>
          ))}
        </aside>

        <div className="homepage-workspace-list" role="list" aria-label="Список обращений">
          {active.rows.map((row, index) => (
            <div role="listitem" className={`homepage-workspace-list-row${index === 0 ? " is-active" : ""}`} key={`${activeTab}-${row.name}`}>
              <span className="homepage-workspace-list-avatar" aria-hidden="true">{row.initials}</span>
              <div><strong>{row.name}{row.rating ? <> <span>{row.rating}</span></> : null}</strong><p>{row.text}</p></div>
              <span className="homepage-workspace-time">{row.time}</span>
            </div>
          ))}
        </div>

        <div className="homepage-workspace-answer" role="group" aria-label="Подготовленный ответ">
          <div className="homepage-workspace-answer-head"><span className={`homepage-workspace-answer-dot is-${active.tone}`} aria-hidden="true" /><strong>Ответ с помощью ИИ</strong></div>
          <p>{active.answer}</p>
          <div className="homepage-workspace-answer-actions" aria-hidden="true"><span>Дружелюбный⌄</span><b>Отправить&nbsp; →</b></div>
        </div>
      </div>
    </div>
  );
}
