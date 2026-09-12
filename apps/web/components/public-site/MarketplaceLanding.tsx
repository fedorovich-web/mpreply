import Link from "next/link";

import type { MarketplaceConfig } from "../../lib/site-config";
import { PublicShell } from "./PublicShell";

type MarketplaceLandingProps = {
  marketplace: MarketplaceConfig;
};

const workflow = [
  ["01", "Получаем обращение", "Отзывы, вопросы и сообщения покупателей появляются в общей очереди вместе с площадкой и текущим статусом."],
  ["02", "Показываем контекст", "Сотрудник видит доступные данные товара, покупателя и самого обращения без поиска по нескольким кабинетам."],
  ["03", "Готовим ответ", "ИИ помогает подготовить черновик с учётом контекста, правил команды и заданного тона коммуникации."],
  ["04", "Отправляем или проверяем", "Типовые сценарии можно автоматизировать, а неоднозначные и чувствительные обращения оставлять сотруднику."],
];

export function MarketplaceLanding({ marketplace }: MarketplaceLandingProps) {
  return (
    <PublicShell>
      <section className="public-subhero public-subhero-marketplace-detail">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <span className="public-status public-status-supported">{marketplace.statusLabel}</span>
            <p className="eyebrow">Интеграция с {marketplace.name}</p>
            <h1>Отзывы, вопросы и сообщения {marketplace.name} — в единой очереди</h1>
            <p className="public-lead">{marketplace.summary}</p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                Подключить {marketplace.name}
              </Link>
              <Link className="button button-secondary" href="/demo">
                Посмотреть интерфейс
              </Link>
            </div>
          </div>

          <aside className="integration-status-panel integration-status-panel-supported" aria-label={`Интеграция ${marketplace.name}`}>
            <div className="integration-status-topline">
              <span className="marketplace-monogram marketplace-monogram-large" aria-hidden="true">{marketplace.shortName}</span>
              <span className="public-status public-status-supported">Интеграция готова</span>
            </div>
            <strong>{marketplace.name} работает в общем процессе обработки обращений</strong>
            <p>
              Площадка подключается к тому же интерфейсу, что и остальные интеграции: очередь, контекст, подготовка ответа, проверка и отправка остаются в одном рабочем пространстве.
            </p>
          </aside>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container marketplace-detail-story">
          <div className="section-heading">
            <p className="eyebrow">Один рабочий процесс</p>
            <h2>От нового обращения на {marketplace.name} до готового ответа</h2>
            <p>Команда работает по одной логике независимо от того, с какой площадки пришёл покупатель.</p>
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
            <p className="eyebrow">Автоматизация под правила команды</p>
            <h2>Рутину можно отправлять автоматически. Исключения — оставлять человеку.</h2>
            <p className="public-copy-muted">
              Настройте, какие обращения проходят автоматически, а где обязательна проверка сотрудником. Контроль остаётся частью рабочего процесса, а не отдельной ручной операцией.
            </p>
          </div>
          <div className="public-check-list public-check-list-large">
            <p>Контекст товара и обращения рядом с ответом.</p>
            <p>Автоотправка только для выбранных сценариев.</p>
            <p>Проверка человеком для исключений и чувствительных тем.</p>
            <p>Понятный статус обработки и история действий.</p>
          </div>
        </div>
      </section>

      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div>
            <p className="eyebrow">{marketplace.name} уже поддерживается</p>
            <h2>Подключите площадку и начните работать с обращениями в общей очереди</h2>
          </div>
          <div className="cta-actions-on-dark">
            <Link className="button button-secondary button-secondary-on-dark" href="/marketplaces">
              Сравнить интеграции
            </Link>
            <Link className="button button-primary button-on-dark" href="/auth/register?intent=connect-marketplace">
              Начать подключение
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
