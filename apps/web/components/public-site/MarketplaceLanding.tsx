import Link from "next/link";

import type { MarketplaceConfig } from "../../lib/site-config";
import { MarketingGlyph } from "./MarketingGlyph";
import { PublicShell } from "./PublicShell";
import { PublicTrialCta } from "./PublicTrialCta";

const platformScenarios = {
  wildberries: [
    {
      icon: "reviews" as const,
      title: "Отзывы с учётом оценки и товара",
      text: "MPReply готовит персональный ответ, учитывает рейтинг и публикует его автоматически по правилам продавца.",
    },
    {
      icon: "questions" as const,
      title: "Вопросы по карточке товара",
      text: "Характеристики, комплектация, размер и совместимость проверяются по доступным данным до формирования ответа.",
    },
    {
      icon: "history" as const,
      title: "История решений по магазину",
      text: "Команда видит, почему ответ был опубликован автоматически, изменён или отправлен на согласование по настройке.",
    },
  ],
  ozon: [
    {
      icon: "reviews" as const,
      title: "Ответы на отзывы покупателей",
      text: "MPReply учитывает оценку, текст обращения, товар и стиль бренда, затем публикует ответ автоматически по выбранным правилам.",
    },
    {
      icon: "questions" as const,
      title: "Вопросы о товаре",
      text: "Система сверяет вопрос с характеристиками и базой знаний, чтобы отвечать по существу и не придумывать отсутствующие данные.",
    },
    {
      icon: "chats" as const,
      title: "Диалоги с покупателями",
      text: "Сообщения в чатах обрабатываются с учётом предыдущих реплик и публикуются автоматически, если такой режим выбран продавцом.",
    },
  ],
  "yandex-market": [
    {
      icon: "reviews" as const,
      title: "Отзывы и обратная связь",
      text: "Отзывы и претензии обрабатываются по правилам продавца: MPReply готовит ответ и публикует его автоматически либо отправляет на согласование по настройке.",
    },
    {
      icon: "context" as const,
      title: "Ответы по данным карточки",
      text: "MPReply использует доступные характеристики, описание и инструкции, чтобы отвечать конкретно по товару.",
    },
    {
      icon: "settings" as const,
      title: "Правила для категорий",
      text: "Для разных групп товаров можно настроить отдельный тон, ограничения и режим публикации.",
    },
  ],
  avito: [
    {
      icon: "chats" as const,
      title: "Чаты с сохранением контекста",
      text: "MPReply учитывает предыдущие сообщения и помогает отвечать на вопросы о товаре, условиях и следующем шаге сделки.",
    },
    {
      icon: "reviews" as const,
      title: "Ответы на отзывы",
      text: "Система готовит спокойный персональный ответ и не обещает то, что не разрешено правилами продавца.",
    },
    {
      icon: "flow" as const,
      title: "Передача менеджеру",
      text: "Торг, претензия или нестандартное условие обрабатываются по выбранному сценарию: автопубликация, ответ для команды или согласование.",
    },
  ],
} as const;

const workflowBenefits = [
  "Обращение получает тип, риск и следующий шаг",
  "Ответ строится на доступном контексте товара",
  "Правила бренда применяются до публикации",
  "Сценарии согласования задаются в личном кабинете",
] as const;

type MarketplaceLandingProps = {
  marketplace: MarketplaceConfig;
};

export function MarketplaceLanding({ marketplace }: MarketplaceLandingProps) {
  const scenarios = platformScenarios[marketplace.key];

  return (
    <PublicShell>
      <section className="public-subhero marketplace-detail-hero">
        <div className="public-container public-subhero-grid marketplace-detail-hero-grid">
          <div className="public-subhero-copy">
            <p className="public-eyebrow">MPReply для {marketplace.name}</p>
            <h1>ИИ-ответы покупателям {marketplace.name} с проверкой данных и риска</h1>
            <p className="public-lead">{marketplace.summary}</p>
            <div className="hero-actions">
              <PublicTrialCta className="button button-primary" source={`marketplace-${marketplace.key}`}>
                Начать бесплатный тест
              </PublicTrialCta>
              <Link className="button button-secondary" href="/marketplaces">Все маркетплейсы</Link>
            </div>
          </div>

          <aside className="marketplace-detail-preview" aria-label={`Пример обработки обращения ${marketplace.name}`}>
            <div className="marketplace-detail-preview-head">
              <span className="marketplace-public-monogram" aria-hidden="true">{marketplace.shortName}</span>
              <div>
                <strong>{marketplace.name}</strong>
                <small>Вопрос о совместимости товара</small>
              </div>
            </div>
            <blockquote>«Подойдёт ли товар к моей модели и что выбрать, если нужна другая комплектация?»</blockquote>
            <div className="marketplace-detail-preview-result">
              <span className="home-status home-status-success">Контекст проверен</span>
              <small>Ответ готов к автоматической публикации · согласование включается настройкой</small>
            </div>
          </aside>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <div className="section-heading section-heading-wide">
            <p className="public-eyebrow">Сценарии {marketplace.name}</p>
            <h2>Автоматизируйте разные обращения, а не только короткие отзывы</h2>
            <p>
              MPReply использует отдельную логику для каждого типа обращения: готовит ответ, применяет правила продавца и публикует автоматически, если включён такой режим.
            </p>
          </div>

          <div className="marketplace-public-grid">
            {scenarios.map((scenario) => (
              <article className="marketplace-public-card" key={scenario.title}>
                <MarketingGlyph variant={scenario.icon} />
                <h3>{scenario.title}</h3>
                <p>{scenario.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section public-section-muted">
        <div className="public-container public-two-column public-two-column-balanced">
          <div>
            <p className="public-eyebrow">Контролируемый процесс</p>
            <h2>Одни правила качества для {marketplace.name} и других площадок</h2>
            <p className="public-copy-muted">
              Настройки бренда, база знаний, правила автопубликации и сценарии согласования работают в общей системе, без пересборки процесса для каждого магазина.
            </p>
          </div>
          <div className="public-benefit-panel" role="list" aria-label={`Этапы работы MPReply с ${marketplace.name}`}>
            {workflowBenefits.map((benefit, index) => (
              <div className="public-benefit-item" role="listitem" key={benefit}>
                <span className="public-step-number-v73">{String(index + 1).padStart(2, "0")}</span>
                <p>{benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section public-cta-section">
        <div className="public-container home-final-cta-card public-page-final-cta">
          <div>
            <p className="public-eyebrow">Бесплатный тест</p>
            <h2>Проверьте MPReply на обращениях {marketplace.name}</h2>
            <p>Семь дней, до двух маркетплейсов и 400 ответов бесплатно.</p>
          </div>
          <PublicTrialCta className="button button-primary" source={`marketplace-${marketplace.key}-footer`}>
            Начать бесплатный тест
          </PublicTrialCta>
        </div>
      </section>
    </PublicShell>
  );
}
