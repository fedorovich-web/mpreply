import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";
import { marketplaces } from "../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Интеграции с Wildberries, Ozon, Яндекс Маркетом и Авито",
  description:
    "Интеграции MPReply с Wildberries, Ozon, Яндекс Маркетом и Авито: единая очередь обращений, ИИ-подготовка ответов, правила автоматизации и контроль отправки.",
  path: "/marketplaces",
});

const integrationFlow = [
  ["01", "Подключение", "Добавьте аккаунт площадки в рабочее пространство. Секреты остаются на backend и не возвращаются в браузер в открытом виде."],
  ["02", "Единый формат", "Обращения разных площадок приводятся к общей модели, поэтому команда работает с ними в одном интерфейсе."],
  ["03", "ИИ и правила", "Ответ готовится с доступным контекстом, после чего правила определяют: автоотправка или проверка человеком."],
  ["04", "Отправка и история", "Результат, ошибки и повторные попытки сохраняются, чтобы обработка не превращалась в непрозрачный фоновой процесс."],
];

export default function MarketplacesPage() {
  return (
    <PublicShell>
      <section className="public-subhero public-subhero-marketplaces">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="eyebrow">Интеграции с маркетплейсами</p>
            <h1>Wildberries, Ozon, Яндекс Маркет и Авито — в одном рабочем процессе</h1>
            <p className="public-lead">
              Подключайте площадки к MPReply и обрабатывайте обращения покупателей без постоянного переключения между кабинетами. Источник меняется, логика работы команды остаётся одной.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                Подключить площадку
              </Link>
              <Link className="button button-secondary" href="/demo">
                Посмотреть интерфейс
              </Link>
            </div>
          </div>

          <div className="marketplace-cluster" aria-label="Поддерживаемые маркетплейсы">
            <div className="marketplace-cluster-core">
              <span>MP</span>
              <strong>Одна очередь</strong>
              <small>единые правила</small>
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
            <p className="eyebrow">Поддерживаемые площадки</p>
            <h2>Выберите маркетплейс и посмотрите сценарий работы с обращениями</h2>
            <p>Для каждой площадки сохраняется её API-специфика, но менеджер получает один понятный процесс обработки.</p>
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
            <p className="eyebrow">Под капотом</p>
            <h2>Разные API не должны превращаться в четыре разных процесса для команды</h2>
            <p>MPReply отделяет интеграционную специфику от общей логики ответов, правил и контроля.</p>
          </div>

          <div className="integration-flow-list" role="group" aria-label="Путь обращения через интеграцию">
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
            <p className="eyebrow">Один интерфейс для четырёх площадок</p>
            <h2>Подключите маркетплейсы и начните собирать обращения в общей очереди</h2>
          </div>
          <Link className="button button-primary button-on-dark" href="/auth/register?intent=connect-marketplace">
            Создать аккаунт
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
