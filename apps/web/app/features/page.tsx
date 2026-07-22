import type { Metadata } from "next";
import Link from "next/link";

import { MarketingGlyph } from "../../components/public-site/MarketingGlyph";
import { PublicShell } from "../../components/public-site/PublicShell";
import { PublicTrialCta } from "../../components/public-site/PublicTrialCta";
import { createPageMetadata } from "../../lib/seo";
import { trialOffer } from "../../lib/public-pricing";

export const metadata: Metadata = createPageMetadata({
  title: "Возможности MPReply для отзывов, вопросов и чатов",
  description:
    "Автопубликация, ответы по данным товара, работа с негативом, чаты, правила бренда, журнал решений и аналитика для продавцов маркетплейсов.",
  path: "/features",
});

const capabilities = [
  {
    icon: "reviews" as const,
    title: "Персональные ответы на отзывы",
    text: "MPReply учитывает оценку, содержание отзыва, товар, имя покупателя и тон бренда, затем автоматически публикует ответ по правилам продавца.",
  },
  {
    icon: "questions" as const,
    title: "Ответы на сложные вопросы о товаре",
    text: "Система сверяет вопрос с характеристиками, описанием, инструкциями и базой знаний, чтобы отвечать по существу, а не общими формулировками.",
  },
  {
    icon: "chats" as const,
    title: "Чаты с покупателями",
    text: "MPReply сохраняет контекст диалога, помогает с выбором товара, совместимостью и типовыми вопросами, затем применяет выбранный режим: автопубликация или согласование.",
  },
  {
    icon: "settings" as const,
    title: "Правила и ограничения бренда",
    text: "Задайте тон, длину ответа, стоп-темы, запрещённые обещания и отдельные сценарии автопубликации для разных категорий товаров.",
  },
  {
    icon: "context" as const,
    title: "Контекст конкретного товара",
    text: "Ответ может учитывать карточку товара, FAQ, инструкции, внутреннюю базу знаний и историю обращения. При нехватке данных MPReply не должен додумывать факты.",
  },
  {
    icon: "flow" as const,
    title: "Единый поток и эскалация",
    text: "Отзывы, вопросы и чаты попадают в общий список. Для каждого типа обращения задаётся действие: публиковать автоматически, сохранять ответ для команды или отправлять на согласование.",
  },
  {
    icon: "history" as const,
    title: "Журнал решений",
    text: "Команда видит исходное обращение, использованные данные, подготовленный ответ, причину автопубликации и историю изменений.",
  },
  {
    icon: "recommendations" as const,
    title: "Рекомендации и улучшение качества",
    text: "MPReply помогает находить повторяющиеся вопросы, пробелы в карточках товара и сценарии, которые стоит добавить в базу знаний или правила.",
  },
] as const;

const safetySteps = [
  "Проверка наличия данных до генерации ответа",
  "Оценка тональности, риска и чувствительных тем",
  "Сверка с правилами бренда и ограничениями категории",
  "Автопубликация только при выполнении заданных условий",
  "Настраиваемое согласование по выбранным правилам",
] as const;

export default function FeaturesPage() {
  return (
    <PublicShell>
      <section className="public-subhero">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="public-eyebrow">Возможности MPReply</p>
            <h1>Автоматизация ответов без потери контроля над брендом</h1>
            <p className="public-lead">
              MPReply объединяет отзывы, вопросы и чаты, использует данные товара и автоматически публикует ответы по правилам продавца.
            </p>
            <div className="hero-actions">
              <PublicTrialCta className="button button-primary public-cta-on-dark" source="features-hero">
                Начать бесплатный тест
              </PublicTrialCta>
              <Link className="button button-secondary" href="/pricing">Посмотреть пакеты</Link>
            </div>
            <p className="public-subhero-note">{trialOffer.answerLimit} ответов · до 2 маркетплейсов · бесплатно</p>
          </div>

          <aside className="public-proof-panel-v73" aria-label="Что проверяет MPReply перед публикацией">
            <MarketingGlyph variant="settings" />
            <h2>Что проверяет MPReply</h2>
            <ul>
              {safetySteps.slice(0, 4).map((step) => <li key={step}>{step}</li>)}
            </ul>
          </aside>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <div className="section-heading section-heading-wide">
            <p className="public-eyebrow">Основные сценарии</p>
            <h2>Восемь возможностей для ежедневной работы продавца</h2>
            <p>
              Функции разделены по задачам: MPReply автоматически отвечает покупателям, а продавец управляет правилами публикации и согласования.
            </p>
          </div>

          <div className="feature-capability-grid feature-capability-grid-v73">
            {capabilities.map((capability) => (
              <article className="feature-capability-card" key={capability.title}>
                <MarketingGlyph variant={capability.icon} />
                <h3>{capability.title}</h3>
                <p>{capability.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section public-section-muted">
        <div className="public-container public-two-column public-two-column-balanced">
          <div>
            <p className="public-eyebrow">Безопасность автоматизации</p>
            <h2>Автопубликация работает по правилам продавца, а не как слепой шаблон</h2>
            <p className="public-copy-muted">
              MPReply готовит ответ с учётом данных товара и правил бренда. Режим согласования для отдельных сценариев включается в личном кабинете.
            </p>
          </div>
          <div className="public-benefit-panel" role="list">
            {safetySteps.map((step, index) => (
              <div className="public-benefit-item" role="listitem" key={step}>
                <span className="public-step-number-v73">{String(index + 1).padStart(2, "0")}</span>
                <p>{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="public-section public-cta-section">
        <div className="public-container home-final-cta-card public-page-final-cta">
          <div>
            <p className="public-eyebrow">Тест на реальных обращениях</p>
            <h2>Проверьте функции MPReply на реальных обращениях</h2>
            <p>Семь дней, {trialOffer.answerLimit} ответов и все ключевые сценарии MPReply бесплатно.</p>
          </div>
          <PublicTrialCta className="button button-primary public-cta-on-dark" source="features-footer">
            Начать бесплатный тест
          </PublicTrialCta>
        </div>
      </div>
    </PublicShell>
  );
}
