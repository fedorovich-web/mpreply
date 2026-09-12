import Link from "next/link";

import type { MarketplaceConfig } from "../../lib/site-config";
import { PublicShell } from "./PublicShell";

type MarketplaceLandingProps = {
  marketplace: MarketplaceConfig;
};

const workflow = [
  ["01", "Получаем обращение", "Интеграционный адаптер принимает доступные обращения и приводит данные площадки к общему формату MPReply."],
  ["02", "Добавляем контекст", "К обращению привязываются доступные данные товара, источник и рабочие правила, необходимые для подготовки ответа."],
  ["03", "Готовим ответ", "ИИ формирует черновик, после чего проверки и правила определяют, можно ли продолжить автоматически."],
  ["04", "Отправляем или передаём менеджеру", "Обычные сценарии могут пройти автоматически, а неоднозначные остаются человеку вместе с контекстом."],
];

export function MarketplaceLanding({ marketplace }: MarketplaceLandingProps) {
  return (
    <PublicShell>
      <section className="public-subhero public-subhero-marketplace-detail">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <span className="public-status public-status-supported">{marketplace.statusLabel}</span>
            <p className="eyebrow">MPReply × {marketplace.name}</p>
            <h1>ИИ-ответы на обращения покупателей {marketplace.name}</h1>
            <p className="public-lead">{marketplace.summary}</p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                Подключить {marketplace.name}
              </Link>
              <Link className="button button-secondary" href="/marketplaces">
                Все интеграции
              </Link>
            </div>
          </div>

          <aside className="integration-status-panel integration-status-panel-supported" aria-label={`Интеграция ${marketplace.name}`}>
            <div className="integration-status-topline">
              <span className="marketplace-monogram marketplace-monogram-large" aria-hidden="true">{marketplace.shortName}</span>
              <span className="public-status public-status-supported">Интеграция реализована</span>
            </div>
            <strong>Площадка подключается к общей очереди обращений</strong>
            <p>
              Менеджеру не нужно осваивать отдельный процесс: источник, статус, ИИ-черновик и решение по отправке видны в одном рабочем пространстве.
            </p>
          </aside>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container marketplace-detail-story">
          <div className="section-heading">
            <p className="eyebrow">Рабочий сценарий</p>
            <h2>От обращения на {marketplace.name} до готового ответа</h2>
            <p>API площадки остаётся на уровне интеграции; команда работает с единым pipeline MPReply.</p>
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
            <p className="eyebrow">Контроль автоматизации</p>
            <h2>Не каждый ответ обязан уходить без участия человека</h2>
            <p className="public-copy-muted">
              Автоматизацию можно оставить для предсказуемых сценариев, а обращения с недостаточным контекстом или отдельными правилами направлять на проверку.
            </p>
          </div>
          <div className="public-check-list public-check-list-large">
            <p>Источник и контекст обращения сохраняются рядом с ответом.</p>
            <p>Правила определяют автоматическую отправку или ручную проверку.</p>
            <p>Ошибки интеграции и повторные попытки имеют явное состояние.</p>
            <p>История действий помогает понять, что произошло с конкретным обращением.</p>
          </div>
        </div>
      </section>

      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div>
            <p className="eyebrow">{marketplace.name} в общей очереди</p>
            <h2>Посмотрите, как обращения площадки выглядят внутри MPReply</h2>
          </div>
          <Link className="button button-primary button-on-dark" href="/demo">
            Посмотреть демо
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
