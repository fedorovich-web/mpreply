import type { Metadata } from "next";
import Link from "next/link";

import { MarketingGlyph } from "../../components/public-site/MarketingGlyph";
import { PublicShell } from "../../components/public-site/PublicShell";
import { PublicTrialCta } from "../../components/public-site/PublicTrialCta";
import { trialOffer } from "../../lib/public-pricing";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "О Respio — автоматические ответы для продавцов маркетплейсов",
  description:
    "Respio — сервис автоматических ИИ-ответов на отзывы, вопросы и чаты маркетплейсов. Мы помогаем продавцам публиковать точные ответы по данным товара и правилам бренда.",
  path: "/about",
});

const principles = [
  {
    icon: "context" as const,
    title: "Ответ опирается на данные товара",
    text: "Перед публикацией Respio сверяет обращение с карточкой товара, базой знаний, правилами продавца и историей диалога.",
  },
  {
    icon: "settings" as const,
    title: "Автопубликация управляется правилами",
    text: "Продавец задаёт сценарии: что публиковать сразу, что сохранить для команды и где включить согласование в личном кабинете.",
  },
  {
    icon: "history" as const,
    title: "Каждое решение видно в журнале",
    text: "Команда получает историю обращения, использованные факты, подготовленный ответ и итоговое действие по каждому случаю.",
  },
] as const;

export default function AboutPage() {
  return (
    <PublicShell>
      <section className="public-subhero about-page-hero-v89">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="public-eyebrow">О Respio</p>
            <h1>Автоматические ответы, которые работают по правилам продавца</h1>
            <p className="public-lead">
              Respio создаётся как рабочий инструмент для продавцов маркетплейсов: сервис понимает обращение покупателя, проверяет данные товара и публикует готовый ответ автоматически, если такой сценарий разрешён настройками.
            </p>
            <div className="hero-actions">
              <PublicTrialCta className="button button-primary" source="about-hero">
                Начать бесплатный тест
              </PublicTrialCta>
              <Link className="button button-secondary" href="/features">Посмотреть возможности</Link>
            </div>
            <p className="public-subhero-note">{trialOffer.answerLimit} ответов · до {trialOffer.marketplaceLimit} маркетплейсов · бесплатно</p>
          </div>

          <aside className="public-proof-panel-v73" aria-label="Фокус Respio">
            <MarketingGlyph variant="flow" />
            <h2>Наш фокус</h2>
            <ul>
              <li>Отзывы, вопросы и чаты маркетплейсов</li>
              <li>Автопубликация по правилам продавца</li>
              <li>Контекст карточки товара и базы знаний</li>
              <li>Журнал решений для команды</li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="public-section about-page-principles-v89" aria-labelledby="about-principles-title">
        <div className="public-container">
          <header className="section-heading section-heading-wide">
            <p className="public-eyebrow">Принципы продукта</p>
            <h2 id="about-principles-title">Respio автоматизирует ответы без хаоса в коммуникации</h2>
            <p>Сервис не заменяет правила бренда. Он применяет их к каждому обращению и помогает быстрее публиковать точные ответы покупателям.</p>
          </header>
          <div className="feature-capability-grid feature-capability-grid-v73">
            {principles.map((principle) => (
              <article className="feature-capability-card" key={principle.title}>
                <MarketingGlyph variant={principle.icon} />
                <h3>{principle.title}</h3>
                <p>{principle.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="public-section public-cta-section">
        <div className="public-container home-final-cta-card public-page-final-cta">
          <div>
            <p className="public-eyebrow">Проверка на ваших обращениях</p>
            <h2>Запустите Respio на реальных отзывах, вопросах и чатах</h2>
            <p>За 7 дней сервис обработает 400 обращений бесплатно и покажет, как работает автопубликация по вашим правилам.</p>
          </div>
          <PublicTrialCta className="button button-primary public-cta-on-dark" source="about-footer">
            Начать бесплатный тест
          </PublicTrialCta>
        </div>
      </div>
    </PublicShell>
  );
}
