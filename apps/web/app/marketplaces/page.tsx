import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";
import { marketplaces } from "../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Интеграции MPReply с Wildberries, Ozon, Яндекс Маркетом и Авито",
  description:
    "Подключите Wildberries, Ozon, Яндекс Маркет и Авито к MPReply. Отзывы, вопросы и сообщения покупателей собираются в одном окне для ИИ-ответов, проверки и автоматической отправки.",
  path: "/marketplaces",
});

const integrationFlow = [
  ["01", "Подключите кабинеты", "Добавьте нужные маркетплейсы в рабочее пространство MPReply и управляйте подключениями из одного места."],
  ["02", "Получайте обращения", "Отзывы, вопросы и сообщения покупателей собираются в общей очереди с указанием площадки и контекста."],
  ["03", "Готовьте ответы с ИИ", "MPReply помогает сформировать ответ с учётом товара и правил вашей команды."],
  ["04", "Отправляйте по своим правилам", "Типовые ответы можно автоматизировать, а сложные обращения оставлять на проверку сотруднику."],
];

export default function MarketplacesPage() {
  return (
    <PublicShell>
      <section className="public-subhero public-subhero-marketplaces">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="eyebrow">Интеграции с маркетплейсами</p>
            <h1>Все обращения с Wildberries, Ozon, Яндекс Маркета и Авито — в одном окне</h1>
            <p className="public-lead">
              Подключайте площадки к MPReply и отвечайте покупателям из единого рабочего пространства. Не нужно держать открытыми несколько кабинетов и переносить контекст вручную.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                Создать аккаунт
              </Link>
              <Link className="button button-secondary" href="/demo">
                Посмотреть интерфейс
              </Link>
            </div>
          </div>

          <div className="marketplace-cluster" role="group" aria-label="Поддерживаемые маркетплейсы">
            <div className="marketplace-cluster-core">
              <span>MP</span>
              <strong>Одно окно</strong>
              <small>для всех обращений</small>
            </div>
            {marketplaces.map((marketplace, index) => (
              <Link
                className={`marketplace-cluster-item marketplace-cluster-item-${index + 1}`}
                href={marketplace.path}
                key={marketplace.key}
              >
                <span>{marketplace.shortName.slice(0, 2)}</span>
                <strong>{marketplace.name}</strong>
                <small>{marketplace.statusLabel}</small>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <div className="section-heading section-heading-wide">
            <p className="eyebrow">4 готовые интеграции</p>
            <h2>Подключите площадки, на которых уже работает ваш бизнес</h2>
            <p>Каждая интеграция подключается к общей очереди MPReply, поэтому команда работает с обращениями по одному понятному сценарию.</p>
          </div>

          <div className="marketplace-readiness-list">
            {marketplaces.map((marketplace) => (
              <article className="marketplace-readiness-row marketplace-readiness-row-supported" key={marketplace.key}>
                <div className="marketplace-readiness-brand">
                  <span className="marketplace-monogram" aria-hidden="true">{marketplace.shortName}</span>
                  <div>
                    <h3>{marketplace.name}</h3>
                    <span className="public-status public-status-supported">{marketplace.statusLabel}</span>
                  </div>
                </div>
                <p>{marketplace.summary}</p>
                <Link className="button button-secondary marketplace-readiness-action" href={marketplace.path}>
                  Подробнее
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section public-section-muted">
        <div className="public-container marketplace-flow-layout">
          <div className="section-heading">
            <p className="eyebrow">Один рабочий процесс</p>
            <h2>Площадка меняется. Работа команды остаётся привычной.</h2>
            <p>MPReply объединяет обращения разных маркетплейсов в одном интерфейсе и сохраняет единые правила подготовки и отправки ответов.</p>
          </div>

          <div className="integration-flow-list" role="group" aria-label="Работа с подключёнными маркетплейсами">
            {integrationFlow.map(([number, title, text]) => (
              <article className="integration-flow-row" key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div>
            <p className="eyebrow">Все площадки в MPReply</p>
            <h2>Соберите отзывы, вопросы и сообщения покупателей в одной очереди</h2>
          </div>
          <Link className="button button-primary button-on-dark" href="/auth/register?intent=connect-marketplace">
            Создать аккаунт
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
