"use client";

import { useId, useState } from "react";

type WorkspaceTab = "reviews" | "questions" | "messages";

type WorkspaceState = {
  label: string;
  title: string;
  source: string;
  meta: string;
  customerText: string;
  answer: string;
  state: string;
};

const workspaceStates: Record<WorkspaceTab, WorkspaceState> = {
  reviews: {
    label: "Отзывы",
    title: "Отзыв о товаре",
    source: "Wildberries",
    meta: "5 звёзд · Артикул 481205",
    customerText: "Качество отличное, доставка быстрая. Спасибо!",
    answer: "Спасибо за отзыв! Рады, что товар и доставка оправдали ожидания.",
    state: "Готов к отправке",
  },
  questions: {
    label: "Вопросы",
    title: "Вопрос покупателя",
    source: "Ozon",
    meta: "Карточка товара · SKU 24018",
    customerText: "Подойдёт ли размер M на рост 174 см?",
    answer: "Для роста 174 см размер M обычно подходит. Если хотите более свободную посадку, ориентируйтесь ещё и на параметры в таблице размеров.",
    state: "Нужна проверка",
  },
  messages: {
    label: "Сообщения",
    title: "Диалог с покупателем",
    source: "Авито",
    meta: "Новое сообщение · 2 минуты назад",
    customerText: "Здравствуйте! Когда сможете отправить заказ?",
    answer: "Здравствуйте! Заказ можно подготовить к отправке сегодня. После передачи в доставку статус обновится автоматически.",
    state: "Ответ подготовлен",
  },
};

const tabs = Object.entries(workspaceStates) as Array<[WorkspaceTab, WorkspaceState]>;

export function HomeWorkspaceTabs() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("reviews");
  const id = useId();
  const active = workspaceStates[activeTab];

  return (
    <div className="homepage-workspace">
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
              onClick={() => setActiveTab(key)}
            >
              {item.label}
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
        <aside className="homepage-workspace-queue" aria-label="Очередь обращений">
          <div className="homepage-workspace-queue-head">
            <strong>Входящие</strong>
            <span>4 площадки</span>
          </div>
          <div className="homepage-workspace-queue-item is-active">
            <span className="homepage-marketplace-mark" aria-hidden="true">{active.source.slice(0, 2)}</span>
            <div>
              <strong>{active.title}</strong>
              <small>{active.source}</small>
            </div>
          </div>
          <div className="homepage-workspace-queue-item">
            <span className="homepage-marketplace-mark is-muted" aria-hidden="true">ЯМ</span>
            <div>
              <strong>Новое обращение</strong>
              <small>Яндекс Маркет</small>
            </div>
          </div>
          <div className="homepage-workspace-queue-item">
            <span className="homepage-marketplace-mark is-muted" aria-hidden="true">OZ</span>
            <div>
              <strong>Ожидает ответа</strong>
              <small>Ozon</small>
            </div>
          </div>
        </aside>

        <article className="homepage-workspace-conversation">
          <div className="homepage-workspace-titlebar">
            <div>
              <span>{active.source}</span>
              <h3>{active.title}</h3>
            </div>
            <small>{active.meta}</small>
          </div>

          <div className="homepage-message homepage-message-customer">
            <span>Покупатель</span>
            <p>{active.customerText}</p>
          </div>

          <div className="homepage-ai-draft">
            <div className="homepage-ai-draft-head">
              <div>
                <span className="homepage-ai-spark" aria-hidden="true">AI</span>
                <strong>Черновик ответа</strong>
              </div>
              <span className="homepage-ai-state">{active.state}</span>
            </div>
            <p>{active.answer}</p>
            <div className="homepage-ai-actions" role="group" aria-label="Пример действий с ответом">
              <span>Изменить</span>
              <span>Проверить</span>
              <span className="is-primary">Отправить</span>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
