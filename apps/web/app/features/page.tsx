import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Возможности MPReply — обращения, ИИ-ответы и автоматизация",
  description:
    "Единая очередь обращений с Wildberries, Ozon, Яндекс Маркета и Авито, подготовка ответов с ИИ, контроль качества, автоответы, шаблоны, аналитика и командная работа.",
  path: "/features",
});

const tools = [
  {
    icon: "✉",
    tone: "blue",
    title: "Единая очередь обращений",
    text: "Отзывы, вопросы и сообщения со всех подключённых площадок собраны в одном окне.",
  },
  {
    icon: "✦",
    tone: "purple",
    title: "AI-подготовка ответов",
    text: "Получайте готовый черновик с учётом обращения, товара, истории и тона бренда.",
  },
  {
    icon: "✓",
    tone: "green",
    title: "Контроль качества",
    text: "Проверяйте чувствительные и нестандартные ответы перед отправкой покупателю.",
  },
  {
    icon: "ϟ",
    tone: "orange",
    title: "Автоответы и сценарии",
    text: "Автоматизируйте типовые обращения и оставляйте исключения сотруднику.",
  },
  {
    icon: "▤",
    tone: "blue",
    title: "Шаблоны ответов",
    text: "Используйте единые формулировки команды и быстро адаптируйте их под ситуацию.",
  },
  {
    icon: "▥",
    tone: "blue",
    title: "Аналитика",
    text: "Следите за потоком обращений, ответами и результатами работы в одном месте.",
  },
  {
    icon: "●",
    tone: "purple",
    title: "Командная работа",
    text: "Распределяйте обращения и сохраняйте общий стандарт коммуникации для всей команды.",
  },
  {
    icon: "◷",
    tone: "purple",
    title: "История действий",
    text: "Видите, что происходило с обращением: подготовка, проверка, отправка и статус.",
  },
] as const;

const workflow = [
  {
    icon: "✉",
    title: "Обращение на маркетплейсе",
    text: "Покупатель оставляет отзыв, вопрос или сообщение на подключённой площадке.",
  },
  {
    icon: "▤",
    title: "Все обращения в MPReply",
    text: "Сервис собирает их в единую очередь с площадкой, товаром и нужным контекстом.",
  },
  {
    icon: "✦",
    title: "AI помогает с ответом",
    text: "MPReply готовит черновик по правилам команды — автоматически или для проверки.",
  },
  {
    icon: "➤",
    title: "Довольный клиент",
    text: "Готовый ответ отправляется покупателю, а результат и история остаются в системе.",
  },
] as const;

const benefits = [
  ["Быстрее отвечайте", "Все обращения и следующий шаг уже перед глазами команды."],
  ["Держите качество", "Тон бренда, правила и ручная проверка работают в одном процессе."],
  ["Снимайте рутину", "Повторяющиеся сценарии можно автоматизировать без потери контроля."],
  ["Видите результат", "Статусы и история действий помогают разбирать каждый случай."],
] as const;

const messages = [
  ["wb", "WB", "Подойдёт ли размер 42 на рост 170?", "2 мин"],
  ["oz", "OZ", "Когда будет в наличии?", "15 мин"],
  ["ym", "М", "Спасибо, всё подошло!", "1 час"],
  ["av", "A", "Можно узнать состав материала?", "2 часа"],
] as const;

export default function FeaturesPage() {
  return (
    <PublicShell>
      <div className="mockup-page">
        <section className="features-mockup-hero mockup-hero">
          <div className="public-container mockup-hero-grid">
            <div className="mockup-hero-copy">
              <p className="mockup-eyebrow">Больше возможностей — больше довольных клиентов</p>
              <h1>
                Все возможности MPReply для работы с <span className="mockup-highlight">обращениями покупателей</span>
              </h1>
              <p>
                Собирайте отзывы, вопросы и сообщения в одном окне, готовьте качественные ответы с помощью ИИ и автоматизируйте повторяющиеся сценарии без потери контроля.
              </p>
              <div className="mockup-actions">
                <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                  Попробовать бесплатно <span aria-hidden="true">→</span>
                </Link>
                <Link className="button button-secondary" href="/demo">
                  Смотреть демо
                </Link>
              </div>
              <div className="mockup-trust-row" aria-label="Условия старта">
                <span>14 дней бесплатно</span>
                <span>Без карты</span>
                <span>Быстрое подключение</span>
              </div>
            </div>

            <div className="features-mockup-scene" role="img" aria-label="Единая очередь MPReply с обращениями и подготовленным ответом">
              <div className="features-window">
                <div className="features-window-top">
                  <strong>Все обращения</strong>
                  <span>24 обращения</span>
                </div>
                <div className="features-window-body">
                  <div className="features-feed">
                    <div className="features-feed-tabs" aria-hidden="true">
                      <span>Все</span>
                      <span>Отзывы</span>
                      <span>Вопросы</span>
                      <span>Сообщения</span>
                    </div>
                    {messages.map(([tone, mark, text, time]) => (
                      <div className="features-message" key={`${mark}-${text}`}>
                        <span className={`mockup-market-mark ${tone}`} aria-hidden="true">{mark}</span>
                        <div>
                          <strong>Покупатель</strong>
                          <p>{text}</p>
                        </div>
                        <small>{time}</small>
                      </div>
                    ))}
                  </div>
                  <div className="features-draft-pane">
                    <div className="features-draft-card">
                      <strong>✦ AI предлагает ответ</strong>
                      <p>
                        Да, размер 42 обычно подходит на рост 168–172 см. Если нужна более точная рекомендация, уточните параметры — поможем подобрать размер.
                      </p>
                      <span>Использовать ответ</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mockup-mascot" aria-hidden="true" />
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="mockup-section-head">
              <p className="mockup-eyebrow">Возможности</p>
              <h2>Все инструменты для эффективной работы</h2>
              <p>MPReply объединяет ежедневную работу с обращениями — от получения сообщения до отправленного ответа и истории результата.</p>
            </div>
            <div className="features-tool-grid">
              {tools.map((tool) => (
                <article className="features-tool-card" key={tool.title}>
                  <span className={`mockup-icon-chip ${tool.tone === "blue" ? "" : tool.tone}`} aria-hidden="true">{tool.icon}</span>
                  <h3>{tool.title}</h3>
                  <p>{tool.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="mockup-section-head">
              <p className="mockup-eyebrow">Как это работает</p>
              <h2>От обращения до довольного клиента</h2>
              <p>Четыре понятных шага вместо переключения между кабинетами, копирования контекста и ручной рутины.</p>
            </div>
            <div className="features-workflow">
              {workflow.map((step, index) => (
                <article className="features-workflow-card" key={step.title}>
                  <span className="mockup-step-number">{index + 1}</span>
                  <span className="mockup-icon-chip" aria-hidden="true">{step.icon}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="mockup-section-head">
              <p className="mockup-eyebrow">Почему команды выбирают MPReply</p>
              <h2>Экономьте время и развивайте ваш бизнес</h2>
              <p>Сервис снимает повторяющиеся действия, но оставляет команде контроль там, где он действительно нужен.</p>
            </div>
            <div className="features-benefit-grid">
              {benefits.map(([title, text]) => (
                <article className="features-benefit-card" key={title}>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section public-cta-section">
          <div className="public-container">
            <div className="mockup-cta">
              <p className="mockup-eyebrow">Начните сейчас</p>
              <h2>Начните использовать все возможности MPReply</h2>
              <p>Подключите маркетплейсы и соберите работу с отзывами, вопросами и сообщениями в одном понятном процессе.</p>
              <div className="mockup-actions">
                <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                  Попробовать бесплатно <span aria-hidden="true">→</span>
                </Link>
                <Link className="button button-secondary" href="/demo">Смотреть демо</Link>
              </div>
              <div className="mockup-trust-row" aria-label="Условия старта">
                <span>14 дней бесплатно</span>
                <span>Без карты</span>
                <span>Быстрое подключение</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
