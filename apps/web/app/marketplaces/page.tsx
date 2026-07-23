import type { Metadata } from "next";
import Link from "next/link";

import { MarketingGlyph } from "../../components/public-site/MarketingGlyph";
import { PublicShell } from "../../components/public-site/PublicShell";
import { PublicTrialCta } from "../../components/public-site/PublicTrialCta";
import { createPageMetadata } from "../../lib/seo";
import { marketplaces } from "../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "MP Reply для Wildberries, Ozon, Яндекс Маркета и Авито",
  description:
    "Единый рабочий процесс для отзывов, вопросов и чатов покупателей на Wildberries, Ozon, Яндекс Маркете и Авито.",
  path: "/marketplaces",
});

const platformDetails = {
  wildberries: {
    icon: "reviews" as const,
    text: "Отзывы и вопросы по товарам, правила автопубликации и контроль негативных сценариев.",
  },
  ozon: {
    icon: "questions" as const,
    text: "Отзывы, вопросы о товарах и сообщения покупателей в едином рабочем процессе.",
  },
  "yandex-market": {
    icon: "context" as const,
    text: "Ответы по данным карточки товара, правилам продавца и доступному контексту обращения.",
  },
  avito: {
    icon: "chats" as const,
    text: "Чаты и отзывы с сохранением контекста диалога и настраиваемыми правилами публикации.",
  },
} as const;

export default function MarketplacesPage() {
  return (
    <PublicShell>
      <section className="public-subhero">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="public-eyebrow">Маркетплейсы</p>
            <h1>Отзывы, вопросы и чаты разных площадок — в одном процессе</h1>
            <p className="public-lead">
              Сервис помогает команде работать по единым правилам, даже когда обращения приходят из нескольких кабинетов и магазинов.
            </p>
            <div className="hero-actions">
              <PublicTrialCta className="button button-primary" source="marketplaces-hero">
                Подключить первый маркетплейс
              </PublicTrialCta>
              <Link className="button button-secondary" href="/features">Посмотреть возможности</Link>
            </div>
          </div>

          <aside className="public-proof-panel-v73">
            <MarketingGlyph variant="flow" />
            <h2>Единые правила для всех площадок</h2>
            <ul>
              <li>Один список обращений и статусов</li>
              <li>Общие правила бренда и автопубликации</li>
              <li>История действий по магазину и товару</li>
              <li>Согласование только по заданным правилам</li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <div className="section-heading section-heading-wide">
            <p className="public-eyebrow">Поддерживаемые площадки</p>
            <h2>Выберите маркетплейс и посмотрите сценарии работы</h2>
            <p>Для каждой площадки сохраняется единая логика: получить обращение, проверить контекст, подготовить ответ и выбрать действие.</p>
          </div>

          <div className="marketplace-card-grid marketplace-card-grid-v73">
            {marketplaces.map((marketplace) => {
              const details = platformDetails[marketplace.key];
              return (
                <article className="marketplace-public-card" key={marketplace.key}>
                  <MarketingGlyph variant={details.icon} />
                  <div className="marketplace-card-topline">
                    <h3>{marketplace.name}</h3>
                    <span className="marketplace-public-monogram" aria-hidden="true">{marketplace.shortName}</span>
                  </div>
                  <p>{details.text}</p>
                  <Link className="text-link" href={marketplace.path}>Подробнее о подключении →</Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="public-section public-section-muted">
        <div className="public-container public-two-column public-two-column-balanced">
          <div>
            <p className="public-eyebrow">Без повторной настройки</p>
            <h2>Подключайте следующую площадку к уже настроенным правилам</h2>
            <p className="public-copy-muted">
              Тон бренда, стоп-темы, база знаний и правила эскалации не нужно собирать заново для каждого кабинета.
            </p>
          </div>
          <div className="public-benefit-panel" role="list">
            {[
              "Единый тон и требования к ответам",
              "Общие правила безопасной автопубликации",
              "Фильтрация по магазину, площадке и типу обращения",
              "Общая история работы команды",
            ].map((item, index) => (
              <div className="public-benefit-item" role="listitem" key={item}>
                <span className="public-step-number-v73">{String(index + 1).padStart(2, "0")}</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section public-cta-section">
        <div className="public-container home-final-cta-card public-page-final-cta">
          <div>
            <p className="public-eyebrow">Первое подключение</p>
            <h2>Проверьте автоответы на двух маркетплейсах бесплатно</h2>
            <p>Семь дней и 400 ответов бесплатно.</p>
          </div>
          <PublicTrialCta className="button button-primary" source="marketplaces-footer">
            Начать бесплатный тест
          </PublicTrialCta>
        </div>
      </section>
    </PublicShell>
  );
}
