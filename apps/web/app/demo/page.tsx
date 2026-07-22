import type { Metadata } from "next";

import { MarketingGlyph } from "../../components/public-site/MarketingGlyph";
import { PublicShell } from "../../components/public-site/PublicShell";
import { PublicTrialCta } from "../../components/public-site/PublicTrialCta";
import { createPageMetadata } from "../../lib/seo";
import { trialOffer } from "../../lib/public-pricing";

export const metadata: Metadata = createPageMetadata({
  title: "Бесплатный тест MPReply на 7 дней",
  description:
    "Подключите до двух маркетплейсов и бесплатно проверьте MPReply на реальных отзывах, вопросах и чатах: 7 дней и 400 ответов.",
  path: "/demo",
});

const steps = [
  {
    icon: "flow" as const,
    title: "Подключите до двух маркетплейсов",
    text: "Выберите магазин и канал, на котором хотите проверить MPReply в первую очередь.",
  },
  {
    icon: "context" as const,
    title: "Добавьте правила и данные",
    text: "Укажите тон бренда, стоп-темы и доступные источники знаний для ответов.",
  },
  {
    icon: "reviews" as const,
    title: "Обработайте реальные обращения",
    text: `За ${trialOffer.durationDays} дней можно бесплатно проверить ${trialOffer.answerLimit} ответов на отзывы, вопросы и чаты.`,
  },
  {
    icon: "history" as const,
    title: "Сравните результат",
    text: "Оцените качество автоматических ответов, скорость публикации, сценарии согласования и пробелы в данных товара.",
  },
] as const;

export default function DemoPage() {
  return (
    <PublicShell>
      <section className="public-subhero demo-hero-v73">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="public-eyebrow">{trialOffer.title}</p>
            <h1>Проверьте MPReply на своих обращениях, а не на рекламном примере</h1>
            <p className="public-lead">
              Подключите до двух маркетплейсов, бесплатно обработайте {trialOffer.answerLimit} отзывов, вопросов и сообщений и проверьте автоматическую публикацию по вашим правилам.
            </p>
            <div className="hero-actions">
              <PublicTrialCta className="button button-primary" source="demo-hero">
                Начать бесплатный тест
              </PublicTrialCta>
            </div>
            <p className="public-subhero-note">400 ответов бесплатно · платный пакет не подключается автоматически</p>
          </div>

          <aside className="pricing-trial-panel-v73">
            <MarketingGlyph variant="reviews" />
            <h2>Что входит в тест</h2>
            <ul>
              {trialOffer.features.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
          </aside>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <div className="section-heading section-heading-wide">
            <p className="public-eyebrow">Четыре шага</p>
            <h2>От подключения до измеримого результата</h2>
            <p>Тест построен так, чтобы за семь дней проверить не только генерацию текста, но и автоматическую публикацию по правилам продавца.</p>
          </div>

          <div className="feature-capability-grid feature-capability-grid-v73">
            {steps.map((step) => (
              <article className="feature-capability-card" key={step.title}>
                <MarketingGlyph variant={step.icon} />
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section public-section-muted">
        <div className="public-container public-two-column public-two-column-balanced">
          <div>
            <p className="public-eyebrow">Что измерять</p>
            <h2>Тест должен показать экономию времени и качество, а не просто количество сгенерированных текстов</h2>
          </div>
          <div className="public-benefit-panel" role="list">
            {[
              "Доля ответов, опубликованных автоматически",
              "Количество обращений, правильно переданных менеджеру",
              "Среднее время подготовки ответа",
              "Повторяющиеся пробелы в карточках товара и базе знаний",
            ].map((item, index) => (
              <div className="public-benefit-item" role="listitem" key={item}>
                <span className="public-step-number-v73">{String(index + 1).padStart(2, "0")}</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
