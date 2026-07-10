import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";
import { marketplaces } from "../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Маркетплейсы",
  description:
    "Интеграционная архитектура Respio для Wildberries, Ozon, Яндекс Маркета и Авито с честным статусом production-готовности каждого адаптера.",
  path: "/marketplaces",
});

export default function MarketplacesPage() {
  return (
    <PublicShell>
      <section className="public-hero public-hero-compact">
        <div className="public-container public-hero-copy public-hero-copy-centered">
          <p className="eyebrow">Marketplace integrations</p>
          <h1>Один SaaS-контур, отдельный adapter для каждого маркетплейса</h1>
          <p className="public-lead">
            Respio не маскирует roadmap под готовые интеграции. Ниже указан реальный статус: Wildberries входит в MVP-основу, остальные адаптеры подключаются только после проверки официальных API-контрактов.
          </p>
        </div>
      </section>
      <section className="public-section">
        <div className="public-container marketplace-card-grid">
          {marketplaces.map((marketplace) => (
            <article className="marketplace-card" key={marketplace.key}>
              <div className="marketplace-card-topline">
                <span className="marketplace-logo-text">{marketplace.shortName}</span>
                <span className={`public-status public-status-${marketplace.status}`}>{marketplace.statusLabel}</span>
              </div>
              <h2>{marketplace.name}</h2>
              <p>{marketplace.summary}</p>
              <Link className="text-link" href={marketplace.path}>Подробнее →</Link>
            </article>
          ))}
        </div>
      </section>
      <section className="public-section public-section-muted">
        <div className="public-container public-two-column">
          <div><p className="eyebrow">Adapter contract</p><h2>Единый внутренний контракт без смешивания marketplace-specific логики</h2></div>
          <div className="public-check-list">
            <p>validate_credentials и health_check.</p>
            <p>fetch_reviews, fetch_questions и нормализация payload.</p>
            <p>send_review_reply, send_question_reply и map_error.</p>
            <p>Rate-limit awareness, integration events и безопасная обработка ошибок.</p>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
