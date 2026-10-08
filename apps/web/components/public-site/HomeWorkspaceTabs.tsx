"use client";

import Link from "next/link";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { Locale } from "../../lib/i18n";
import { HomeLineIcon, type HomeLineIconName } from "./HomeLineIcon";

type WorkspaceTab = "reviews" | "questions" | "messages" | "all";
type WorkspaceTone = "green" | "violet";

type WorkspaceFilter = { icon: HomeLineIconName; label: string };
type WorkspaceRow = { label: string; text: string };
type WorkspaceState = {
  label: string;
  icon: HomeLineIconName;
  answer: string;
  tone: WorkspaceTone;
  filters: readonly WorkspaceFilter[];
  rows: readonly WorkspaceRow[];
};

const workspaceStates: Record<WorkspaceTab, WorkspaceState> = {
  reviews: {
    label: "Отзывы",
    icon: "star",
    answer: "Спасибо за ваш отзыв! Нам очень приятно, что товар вам понравился. Будем рады видеть вас снова!",
    tone: "green",
    filters: [
      { icon: "inbox", label: "Все отзывы" },
      { icon: "star", label: "Положительные" },
      { icon: "clock", label: "Нейтральные" },
      { icon: "question", label: "Отрицательные" },
    ],
    rows: [
      { label: "Отзыв о качестве", text: "Покупатель оценил качество и доставку товара" },
      { label: "Отзыв о товаре", text: "Покупатель поделился впечатлением о заказе" },
      { label: "Замечание о цвете", text: "Покупатель сравнил цвет товара с фотографией" },
      { label: "Отзыв о продавце", text: "Покупатель оставил отзыв о покупке" },
    ],
  },
  questions: {
    label: "Вопросы",
    icon: "question",
    answer: "Спасибо за вопрос! Подготовили ответ с учётом карточки товара и доступной информации.",
    tone: "violet",
    filters: [
      { icon: "inbox", label: "Все вопросы" },
      { icon: "sparkle", label: "Новые" },
      { icon: "question", label: "Требуют ответа" },
      { icon: "send", label: "Отвечено" },
    ],
    rows: [
      { label: "Вопрос о размере", text: "Подойдёт ли размер M на рост 178 см?" },
      { label: "Вопрос об инструкции", text: "Есть ли инструкция на русском языке?" },
      { label: "Вопрос о цвете", text: "Когда появится чёрный цвет?" },
      { label: "Вопрос об использовании", text: "Можно ли использовать товар на улице?" },
    ],
  },
  messages: {
    label: "Сообщения",
    icon: "message",
    answer: "Здравствуйте! Сообщение получено. Ответ подготовлен с учётом контекста обращения.",
    tone: "violet",
    filters: [
      { icon: "inbox", label: "Все сообщения" },
      { icon: "sparkle", label: "Новые" },
      { icon: "clock", label: "В работе" },
      { icon: "send", label: "Закрытые" },
    ],
    rows: [
      { label: "Вопрос об отправке", text: "Когда сможете отправить заказ?" },
      { label: "Вопрос о заказе", text: "Подскажите, пожалуйста, статус заказа" },
      { label: "Вопрос о доставке", text: "Можно изменить адрес доставки?" },
      { label: "Завершённое обращение", text: "Покупатель сообщил, что вопрос решён" },
    ],
  },
  all: {
    label: "Все обращения",
    icon: "inbox",
    answer: "MPReply объединяет отзывы, вопросы и сообщения в одной очереди и помогает отвечать без лишних переключений.",
    tone: "violet",
    filters: [
      { icon: "inbox", label: "Все обращения" },
      { icon: "star", label: "Отзывы" },
      { icon: "question", label: "Вопросы" },
      { icon: "message", label: "Сообщения" },
    ],
    rows: [
      { label: "Отзыв о качестве", text: "Покупатель оценил качество и доставку товара" },
      { label: "Вопрос о размере", text: "Подойдёт ли размер M на рост 178 см?" },
      { label: "Вопрос о заказе", text: "Подскажите, пожалуйста, статус заказа" },
      { label: "Замечание о цвете", text: "Покупатель сравнил цвет товара с фотографией" },
    ],
  },
};

const englishWorkspaceStates: Record<WorkspaceTab, WorkspaceState> = {
  reviews: {
    label: "Reviews", icon: "star", answer: "Thank you for your review. We are glad you liked the item and will pass your feedback to the team.", tone: "green",
    filters: [
      { icon: "inbox", label: "All reviews" }, { icon: "star", label: "Positive" },
      { icon: "clock", label: "Neutral" }, { icon: "question", label: "Negative" },
    ],
    rows: [
      { label: "Product quality", text: "Feedback about the item and delivery" },
      { label: "Product review", text: "Feedback about a recent order" },
      { label: "Color concern", text: "Color differs from the product photo" },
      { label: "Seller review", text: "Feedback about the purchase" },
    ],
  },
  questions: {
    label: "Questions", icon: "question", answer: "Thanks for your question. A teammate will check the product details before confirming the size.", tone: "violet",
    filters: [
      { icon: "inbox", label: "All questions" }, { icon: "sparkle", label: "New" },
      { icon: "question", label: "Need reply" }, { icon: "send", label: "Answered" },
    ],
    rows: [
      { label: "Size question", text: "Would size M fit someone 178 cm tall?" },
      { label: "Instructions", text: "Is an English manual available?" },
      { label: "Color question", text: "When will the black version be available?" },
      { label: "Product use", text: "Can the item be used outdoors?" },
    ],
  },
  messages: {
    label: "Messages", icon: "message", answer: "Hello! We will check the order details before confirming the delivery options.", tone: "violet",
    filters: [
      { icon: "inbox", label: "All messages" }, { icon: "sparkle", label: "New" },
      { icon: "clock", label: "In progress" }, { icon: "send", label: "Closed" },
    ],
    rows: [
      { label: "Shipping question", text: "When can this order be dispatched?" },
      { label: "Order status", text: "What is the current status of this order?" },
      { label: "Delivery address", text: "Can the delivery address be changed?" },
      { label: "Resolved message", text: "The customer confirmed the issue is resolved" },
    ],
  },
  all: {
    label: "All messages", icon: "inbox", answer: "MPReply brings supported reviews, questions, and messages into one queue for the team.", tone: "violet",
    filters: [
      { icon: "inbox", label: "All messages" }, { icon: "star", label: "Reviews" },
      { icon: "question", label: "Questions" }, { icon: "message", label: "Messages" },
    ],
    rows: [
      { label: "Product quality", text: "Feedback about the item and delivery" },
      { label: "Size question", text: "Would size M fit someone 178 cm tall?" },
      { label: "Order status", text: "What is the current status of this order?" },
      { label: "Color concern", text: "Color differs from the product photo" },
    ],
  },
};

const tabOrder: readonly WorkspaceTab[] = ["reviews", "questions", "messages", "all"];

export function HomeWorkspaceTabs({ locale = "ru" }: { locale?: Locale }) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("reviews");
  const id = useId();
  const tabRefs = useRef<Partial<Record<WorkspaceTab, HTMLButtonElement | null>>>({});
  const states = locale === "en" ? englishWorkspaceStates : workspaceStates;
  const active = states[activeTab];
  const labels = locale === "en"
    ? { type: "Message type", filters: "Message filters", list: "Message list", draft: "Sample reply draft", tryDemo: "Try in demo" }
    : { type: "Тип обращения", filters: "Фильтры обращений", list: "Список обращений", draft: "Пример черновика", tryDemo: "Открыть демо" };
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
      <div className="homepage-workspace-tabs" role="tablist" aria-label={labels.type}>
        {tabOrder.map((key) => {
          const item = states[key];
          const selected = key === activeTab;
          return (
            <button key={key} id={`${id}-${key}-tab`} className="homepage-workspace-tab" type="button" role="tab" aria-selected={selected} aria-controls={panelId} tabIndex={selected ? 0 : -1} ref={(node) => { tabRefs.current[key] = node; }} onClick={() => setActiveTab(key)} onKeyDown={(event) => handleTabKeyDown(event, key)}>
              <span><HomeLineIcon name={item.icon} /></span>{item.label}
            </button>
          );
        })}
      </div>

      <div id={panelId} className="homepage-workspace-panel" role="tabpanel" aria-labelledby={`${id}-${activeTab}-tab`}>
        <aside className="homepage-workspace-queue" aria-label={labels.filters}>
          <strong>{active.label}</strong>
          {active.filters.map((filter, index) => (
            <div className={`homepage-workspace-filter${index === 0 ? " is-active" : ""}`} key={filter.label}><span aria-hidden="true"><HomeLineIcon name={filter.icon} /></span><b>{filter.label}</b></div>
          ))}
        </aside>

        <div className="homepage-workspace-list" role="list" aria-label={labels.list}>
          {active.rows.map((row, index) => (
            <div role="listitem" className={`homepage-workspace-list-row${index === 0 ? " is-active" : ""}`} key={`${activeTab}-${row.label}`}>
              <div><strong>{row.label}</strong><p>{row.text}</p></div>
            </div>
          ))}
        </div>

        <div className="homepage-workspace-answer" role="group" aria-label={labels.draft}>
          <div className="homepage-workspace-answer-head"><span className={`homepage-workspace-answer-dot is-${active.tone}`} aria-hidden="true" /><strong>{labels.draft}</strong></div>
          <p>{active.answer}</p>
          <div className="homepage-workspace-answer-actions"><Link href={locale === "en" ? "/en/demo" : "/demo"}>{labels.tryDemo}</Link></div>
        </div>
      </div>
    </div>
  );
}
