import Link from "next/link";

import type { MarketplaceConfig } from "../../lib/site-config";
import { PublicShell } from "./PublicShell";

type MarketplaceLandingProps = {
  marketplace: MarketplaceConfig;
};

export function MarketplaceLanding({ marketplace }: MarketplaceLandingProps) {
  const isMvp = marketplace.status === "mvp";

  return (
    <PublicShell>
      <section className="public-hero public-hero-compact">
        <div className="public-container public-hero-grid">
          <div className="public-hero-copy">
            <span className={`public-status public-status-${marketplace.status}`}>
              {marketplace.statusLabel}
            </span>
            <p className="eyebrow">Respio × {marketplace.name}</p>
            <h1>AI-ответы на отзывы и вопросы {marketplace.name}</h1>
            <p className="public-lead">{marketplace.summary}</p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/demo">
                Посмотреть workflow
              </Link>
              <Link className="button button-secondary" href="/marketplaces">
                Все маркетплейсы
              </Link>
            </div>
          </div>
          <aside className="public-note-card" aria-label="Статус интеграции">
            <span className="panel-kicker">Статус</span>
            <strong>{marketplace.statusLabel}</strong>
            <p>
              {isMvp
                ? "MVP-адаптер уже входит в текущую техническую основу Respio. Перед production-запуском обязательны реальные API credentials, интеграционные тесты и проверка лимитов кабинета."
                : "Мы не заявляем production-доступность до проверки официальных API-контрактов, ограничений и допустимых сценариев автоматической отправки."}
            </p>
          </aside>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <div className="section-heading">
            <p className="eyebrow">Как работает Respio</p>
            <h2>Один pipeline от импорта обращения до безопасного ответа</h2>
          </div>
          <div className="feature-grid feature-grid-3">
            <article className="feature-card">
              <span className="feature-number">01</span>
              <h3>Импорт и нормализация</h3>
              <p>Адаптер получает обращения, нормализует формат и подавляет дубликаты.</p>
            </article>
            <article className="feature-card">
              <span className="feature-number">02</span>
              <h3>AI + SafetyGate</h3>
              <p>AI готовит черновик, а SafetyGate проверяет рискованные обещания и недостаток контекста.</p>
            </article>
            <article className="feature-card">
              <span className="feature-number">03</span>
              <h3>Автоответ или ручная проверка</h3>
              <p>Безопасные ответы идут дальше по правилам; спорные обращения не отправляются автоматически.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="public-section public-section-muted">
        <div className="public-container public-two-column">
          <div>
            <p className="eyebrow">Auto-first</p>
            <h2>Автоматизация по умолчанию, ручной контроль — когда он действительно нужен</h2>
          </div>
          <div className="public-check-list">
            <p>Правила по типу обращения, рейтингу, ключевым словам и товарному контексту.</p>
            <p>Runtime-квоты и idempotency перед постановкой ответа в очередь.</p>
            <p>Worker-backed отправка с retry для временных сетевых ошибок.</p>
            <p>Audit trail для действий пользователя, AI и интеграционных событий.</p>
          </div>
        </div>
      </section>

      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div>
            <p className="eyebrow">Следующий шаг</p>
            <h2>Посмотрите, как Respio принимает решение об автоответе</h2>
          </div>
          <Link className="button button-primary" href="/demo">
            Открыть демо
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
