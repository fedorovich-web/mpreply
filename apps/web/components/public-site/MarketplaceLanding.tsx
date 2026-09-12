import Link from "next/link";

import type { MarketplaceConfig } from "../../lib/site-config";
import { PublicShell } from "./PublicShell";

type MarketplaceLandingProps = {
  marketplace: MarketplaceConfig;
};

const workflow = [
  ["01", "Получаем обращение", "Отзывы, вопросы и доступные сообщения с площадки появляются в общей очереди MPReply."],
  ["02", "Добавляем контекст", "К обращению подтягиваются доступные данные товара и правила вашей команды."],
  ["03", "Готовим ответ", "ИИ формирует черновик, который можно проверить, отредактировать или передать в автоматическую обработку."],
  ["04", "Отправляем", "Типовые сценарии можно автоматизировать, а сложные обращения оставлять менеджеру."],
];

export function MarketplaceLanding({ marketplace }: MarketplaceLandingProps) {
  return (
    <PublicShell>
      <section className="public-subhero public-subhero-marketplace-detail">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <span className="public-status public-status-supported">{marketplace.statusLabel}</span>
            <p className="eyebrow">MPReply × {marketplace.name}</p>
            <h1>Автоответы на обращения покупателей {marketplace.name}</h1>
            <p className="public-lead">{marketplace.summary}</p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                Подключить {marketplace.name}
              </Link>
              <Link className="button button-secondary" href="/demo">
                Посмотреть демо
              </Link>
            </div>
          </div>

          <aside className="integration-status-panel integration-status-panel-supported" aria-label={`Интеграция ${marketplace.name}`}>
            <div className="integration-status-topline">
              <span className="marketplace-monogram marketplace-monogram-large" aria-hidden="true">{marketplace.shortName}</span>
              <span className="public-status public-status-supported">Интеграция готова</span>
            </div>
            <strong>{marketplace.name} подключается к общей очереди MPReply</strong>
            <p>
              Работайте с обращениями площадки в том же интерфейсе, что и с другими маркетплейсами: контекст, ИИ-ответ, проверка и отправка находятся рядом.
            </p>
          </aside>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container marketplace-detail-story">
          <div className="section-heading">
            <p className="eyebrow">Как это работает</p>
            <h2>От нового обращения на {marketplace.name} до готового ответа</h2>
            <p>Команда видит один понятный процесс независимо от того, с какой площадки пришёл покупатель.</p>
          </div>

          <div className="integration-flow-list" role="group" aria-label={`Обработка обращений ${marketplace.name}`}>
            {workflow.map(([number, title, text]) => (
              <article className="integration-flow-row" key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section public-section-muted">
        <div className="public-container public-two-column public-two-column-balanced">
          <div>
            <p className="eyebrow">Автоматизация под ваши правила</p>
            <h2>Отправляйте типовые ответы автоматически, а сложные оставляйте человеку</h2>
            <p className="public-copy-muted">
              Вы сами определяете, где можно ускорить работу, а где нужен контроль менеджера. Это позволяет автоматизировать рутину без потери качества общения.
            </p>
          </div>
          <div className="public-check-list public-check-list-large">
            <p>Контекст обращения и товара рядом с черновиком ответа.</p>
            <p>Автоматическая отправка для выбранных сценариев.</p>
            <p>Ручная проверка для исключений и чувствительных тем.</p>
            <p>Понятные статусы и история работы с обращением.</p>
          </div>
        </div>
      </section>

      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div>
            <p className="eyebrow">{marketplace.name} в MPReply</p>
            <h2>Подключите площадку и отвечайте покупателям из единого рабочего пространства</h2>
          </div>
          <div className="cta-actions-on-dark">
            <Link className="button button-secondary button-secondary-on-dark" href="/marketplaces">
              Все интеграции
            </Link>
            <Link className="button button-primary button-on-dark" href="/auth/register?intent=connect-marketplace">
              Создать аккаунт
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
