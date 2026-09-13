import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";
import { marketplaces } from "../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Маркетплейсы и статус интеграций Respio",
  description:
    "Актуальный статус интеграций Respio: Wildberries входит в MVP-основу, остальные площадки не заявляются готовыми до проверки официальных API и runtime-тестов.",
  path: "/marketplaces",
});

const adapterPrinciples = [
  ["Проверка доступа", "Credentials валидируются на backend и не возвращаются во frontend в открытом виде."],
  ["Нормализация", "Отзывы, вопросы и товарный контекст приводятся к внутренним моделям Respio."],
  ["Отправка", "Marketplace-specific методы изолированы внутри adapter, а не размазаны по application layer."],
  ["Ошибки и лимиты", "Временные и терминальные ошибки разделяются, а ограничения площадки учитываются в execution flow."],
];

export default function MarketplacesPage() {
  const mvpMarketplace = marketplaces.find((marketplace) => marketplace.status === "mvp");
  const plannedMarketplaces = marketplaces.filter((marketplace) => marketplace.status === "planned");

  return (
    <PublicShell>
      <section className="public-subhero public-subhero-marketplaces">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="eyebrow">Интеграции</p>
            <h1>Один рабочий процесс — отдельный адаптер для каждой площадки</h1>
            <p className="public-lead">
              Respio не выдаёт roadmap за готовый продукт. Для каждой площадки мы отдельно проверяем официальный API, права доступа, ограничения, отправку ответов и фактическое поведение в runtime.
            </p>
          </div>

          <div className="readiness-summary" role="group" aria-label="Текущий статус интеграций">
            <div className="readiness-summary-primary">
              <span className="public-status public-status-mvp">MVP-интеграция</span>
              <strong>{mvpMarketplace?.name ?? "Wildberries"}</strong>
              <p>Реальный adapter, импорт отзывов и вопросов, AI draft, SafetyGate и worker-backed отправка входят в текущую техническую основу.</p>
            </div>
            <div className="readiness-summary-planned">
              <span>{plannedMarketplaces.length} площадки</span>
              <p>Планируются, но не называются production-ready до отдельной технической проверки.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <div className="section-heading section-heading-wide">
            <h2>Готовность каждой интеграции видна отдельно</h2>
            <p>Статус не зависит от того, есть ли на сайте отдельная landing page: готовой считается только проверенная реализация.</p>
          </div>

          <div className="marketplace-readiness-list">
            {marketplaces.map((marketplace) => (
              <article className={`marketplace-readiness-row marketplace-readiness-row-${marketplace.status}`} key={marketplace.key}>
                <div className="marketplace-readiness-brand">
                  <span className="marketplace-monogram" aria-hidden="true">{marketplace.shortName}</span>
                  <div>
                    <h3>{marketplace.name}</h3>
                    <span className={`public-status public-status-${marketplace.status}`}>{marketplace.statusLabel}</span>
                  </div>
                </div>
                <p>{marketplace.summary}</p>
                <Link className="button button-secondary marketplace-readiness-action" href={marketplace.path}>
                  Открыть статус
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section public-section-muted">
        <div className="public-container">
          <div className="section-heading section-heading-wide">
            <h2>Специфика площадки остаётся внутри её адаптера</h2>
            <p>Это позволяет развивать новые интеграции без marketplace-specific хаоса в общих сервисах Respio.</p>
          </div>

          <div className="adapter-principles">
            {adapterPrinciples.map(([title, text]) => (
              <article className="adapter-principle" key={title}>
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
            <h2>Выберите маркетплейс и посмотрите его фактический статус до подключения</h2>
          </div>
          <Link className="button button-primary button-on-dark" href="/auth/register?intent=connect-marketplace">
            Подключить маркетплейс
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
