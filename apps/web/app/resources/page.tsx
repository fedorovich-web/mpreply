import type { Metadata } from "next";
import { MarketingGlyph } from "../../components/public-site/MarketingGlyph";
import { PublicShell } from "../../components/public-site/PublicShell";
import { PublicTrialCta } from "../../components/public-site/PublicTrialCta";
import { createPageMetadata } from "../../lib/seo";
import { publicResources } from "../../lib/public-resources";

export const metadata: Metadata = createPageMetadata({
  title: "Материалы об ответах на отзывы и вопросы маркетплейсов",
  description:
    "Практические материалы об автоматизации ответов: работа с негативом, база знаний, правила автопубликации и контроль качества ИИ.",
  path: "/resources",
});

export default function ResourcesPage() {
  return (
    <PublicShell>
      <section className="public-subhero">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="public-eyebrow">База знаний</p>
            <h1>Практические материалы для автоматизации общения с покупателями</h1>
            <p className="public-lead">
              Не общие статьи об ИИ, а конкретные правила для отзывов, вопросов, чатов, базы знаний и автоматической публикации.
            </p>
          </div>
          <aside className="public-proof-panel-v73">
            <MarketingGlyph variant="context" />
            <h2>Основные темы</h2>
            <ul>
              <li>Ответы на отзывы и негатив</li>
              <li>Вопросы о товаре и фактология</li>
              <li>Чаты и настройки согласования</li>
              <li>Правила автопубликации</li>
            </ul>
          </aside>
        </div>
      </section>

      <div className="public-section">
        <div className="public-container">
          <div className="resource-library-grid resource-library-grid-v73">
            {publicResources.map((material) => (
              <article className="resource-library-card" key={material.title}>
                <MarketingGlyph variant={material.icon} />
                <span className="resource-state">{material.label}</span>
                <h2>{material.title}</h2>
                <p>{material.text}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="public-section public-cta-section">
        <div className="public-container home-final-cta-card public-page-final-cta">
          <div>
            <p className="public-eyebrow">Проверить на практике</p>
            <h2>Примените правила на реальных обращениях</h2>
            <p>Семь дней и 400 ответов бесплатно.</p>
          </div>
          <PublicTrialCta className="button button-primary public-cta-on-dark" source="resources-footer">Начать тест</PublicTrialCta>
        </div>
      </div>
    </PublicShell>
  );
}
