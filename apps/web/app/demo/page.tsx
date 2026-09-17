import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PublicIcon, type PublicIconName } from "../../components/public-site/PublicIcon";
import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Демо MPReply — как работает обработка обращений",
  description:
    "Посмотрите, как MPReply получает обращения покупателей, анализирует контекст, готовит AI-черновик и передаёт ответ на проверку или отправку.",
  path: "/demo",
});

const logos = {
  wb: {
    name: "Wildberries",
    src: "/images/marketplaces/wildberries.webp",
    compactSrc: "/images/marketplaces/wildberries-compact.webp",
    width: 432,
    height: 188,
  },
  oz: {
    name: "Ozon",
    src: "/images/marketplaces/ozon.webp",
    compactSrc: "/images/marketplaces/ozon-compact.webp",
    width: 436,
    height: 198,
  },
  ym: {
    name: "Яндекс Маркет",
    src: "/images/marketplaces/yandex-market.webp",
    compactSrc: "/images/marketplaces/yandex-market-compact.webp",
    width: 554,
    height: 222,
  },
  av: {
    name: "Авито",
    src: "/images/marketplaces/avito.webp",
    compactSrc: "/images/marketplaces/avito-compact.webp",
    width: 504,
    height: 212,
  },
} as const;

type MarketplaceLogoKey = keyof typeof logos;

function CompactMarketplaceLogo({
  marketplace,
  size = 36,
  decorative = false,
}: {
  marketplace: MarketplaceLogoKey;
  size?: number;
  decorative?: boolean;
}) {
  const logo = logos[marketplace];

  return (
    <Image
      className="demo-marketplace-compact"
      src={logo.compactSrc}
      width={64}
      height={64}
      alt={decorative ? "" : logo.name}
      aria-hidden={decorative || undefined}
      unoptimized
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}

const journey: readonly [PublicIconName, string, string][] = [
  [
    "message",
    "Получение обращения",
    "Сообщение, отзыв или вопрос поступает из маркетплейса в MPReply в реальном времени.",
  ],
  [
    "document",
    "Анализ контекста",
    "ИИ и система анализируют содержание обращения, историю клиента и товар, чтобы учесть все детали.",
  ],
  [
    "sparkles",
    "AI-черновик",
    "MPReply предлагает готовый ответ с учётом правил бренда и специфики маркетплейса.",
  ],
  [
    "send",
    "Проверка и отправка",
    "Вы проверяете, при необходимости редактируете и отправляете ответ в маркетплейс — прямо из MPReply.",
  ],
];

const scenarios = [
  {
    marketplace: "wb" as MarketplaceLogoKey,
    type: "Отзыв",
    popular: true,
    text: "Покупатель оставил отзыв на товар. Посмотрите, как MPReply помогает корректно и вежливо ответить.",
  },
  {
    marketplace: "oz" as MarketplaceLogoKey,
    type: "Вопрос",
    popular: false,
    text: "Покупатель задаёт вопрос о товаре, доставке или наличии. Посмотрите, как MPReply формирует точный ответ.",
  },
  {
    marketplace: "ym" as MarketplaceLogoKey,
    type: "Сообщение",
    popular: false,
    text: "Личное сообщение от покупателя. Посмотрите, как MPReply учитывает контекст и историю клиента.",
  },
] as const;

const processEvents: readonly [PublicIconName, "green" | "blue" | "purple", string, string, string][] = [
  ["download", "green", "Получено", "12 мар, 14:32", "Сообщение успешно получено из Ozon"],
  ["search", "blue", "Анализ", "12 мар, 14:32", "AI анализирует контекст, товар и историю клиента"],
  ["sparkles", "purple", "AI-черновик", "12 мар, 14:33", "Ответ готов. Ожидает проверки"],
  ["users", "purple", "Ожидает", "12 мар, 14:34", "Вы проверили ответ"],
  ["check-circle", "green", "Отправлено", "12 мар, 14:35", "Ответ успешно отправлен в Ozon"],
];

const teamTools: readonly [PublicIconName, "blue" | "purple" | "orange", string, string][] = [
  [
    "users",
    "purple",
    "Единая очередь обращений",
    "Все отзывы, вопросы и сообщения из подключённых маркетплейсов в одном окне.",
  ],
  [
    "document",
    "blue",
    "Шаблоны ответов",
    "Создавайте готовые формулировки для типовых ситуаций и используйте их всей командой.",
  ],
  [
    "lightning",
    "orange",
    "Автоответы и сценарии",
    "Автоматизируйте повторяющиеся обращения и оставляйте сложные случаи на проверку.",
  ],
  [
    "chart",
    "blue",
    "Аналитика",
    "Следите за скоростью ответов, объёмом обращений и результатами работы команды.",
  ],
];

export default function DemoPage() {
  return (
    <PublicShell>
      <div className="mockup-page">
        <section className="demo-mockup-hero">
          <div className="public-container demo-mockup-grid">
            <div className="demo-mockup-copy">
              <p className="mockup-eyebrow">Демо MPReply</p>
              <h1>Посмотрите, как MPReply ведёт обращение от получения до ответа</h1>
              <p>
                Реальный пример, как покупатель пишет в маркетплейсе, ИИ помогает подготовить ответ,
                а вы проверяете и отправляете его — быстро и удобно.
              </p>
              <div className="mockup-actions">
                <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                  Попробовать бесплатно <span aria-hidden="true">→</span>
                </Link>
                <Link className="button button-secondary" href="#demo-process">
                  <PublicIcon name="play" className="public-inline-icon" /> Смотреть демо
                </Link>
              </div>
              <div className="mockup-trust-row">
                <span>14 дней бесплатно</span>
                <span>Контроль перед отправкой</span>
                <span>Быстрое подключение</span>
              </div>
            </div>

            <div
              className="demo-hero-story"
              role="img"
              aria-label="Путь обращения от покупателя до готового ответа"
            >
              <article className="demo-story-card incoming">
                <div className="demo-story-meta">
                  <CompactMarketplaceLogo marketplace="wb" size={34} decorative />
                  <div>
                    <strong>Покупатель</strong>
                    <small>5 мин назад</small>
                  </div>
                </div>
                <p>Здравствуйте! Подскажите, когда будет поставка этого товара?</p>
              </article>
              <span className="demo-story-arrow a1" aria-hidden="true">↘</span>
              <article className="demo-story-card ai">
                <div className="demo-story-meta demo-story-meta-ai">
                  <span className="demo-story-ai-avatar" aria-hidden="true">
                    <PublicIcon name="sparkles" />
                  </span>
                  <div>
                    <strong>AI MPReply</strong>
                    <small>Предлагает ответ</small>
                  </div>
                </div>
                <p>
                  Здравствуйте! Ожидаем поставку на следующей неделе. Мы сообщим, как только товар снова
                  будет в наличии! Спасибо за ваш интерес! 💙
                </p>
              </article>
              <span className="demo-story-arrow a2" aria-hidden="true">→</span>
              <article className="demo-story-card review">
                <div className="demo-story-meta">
                  <span className="demo-story-review-avatar" aria-hidden="true">
                    <PublicIcon name="users" />
                  </span>
                  <div>
                    <strong>Вы</strong>
                    <small>Проверяете и отправляете</small>
                  </div>
                </div>
                <div className="demo-story-review-bubble">
                  <strong>Отличный ответ!</strong>
                  <span>Отправляем ✅</span>
                </div>
              </article>
              <div className="demo-hero-note" aria-hidden="true">
                Быстрее и проще
                <br />
                с заботой
                <br />
                о каждом клиенте
                <span>↙</span>
              </div>
              <div className="mockup-mascot demo-hero-mascot" aria-hidden="true" />
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Как это работает</p>
              <h2>Путь обращения</h2>
              <p>От сообщения покупателя до отправленного ответа — всего 4 шага.</p>
            </div>

            <div className="demo-journey">
              {journey.map(([icon, title, text], index) => (
                <article className="demo-journey-card" key={title}>
                  <span className="mockup-step-number">{index + 1}</span>
                  <span className={`mockup-icon-chip ${index === 2 ? "purple" : ""}`} aria-hidden="true">
                    <PublicIcon name={icon} />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>

                  {index === 0 ? (
                    <div className="demo-journey-marketplaces" aria-label="Готовые интеграции маркетплейсов">
                      {(Object.keys(logos) as MarketplaceLogoKey[]).map((marketplace) => (
                        <span className="demo-journey-marketplace-chip" key={marketplace}>
                          <CompactMarketplaceLogo marketplace={marketplace} size={30} decorative />
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Примеры из реальной практики</p>
              <h2>Попробуйте разные сценарии</h2>
              <p>Выберите тип обращения, чтобы увидеть, как MPReply помогает на каждом этапе.</p>
            </div>

            <div className="demo-scenarios">
              {scenarios.map((scenario) => (
                <article
                  className={`demo-scenario-card${scenario.popular ? " is-popular" : ""}`}
                  key={scenario.type}
                >
                  <div className="demo-scenario-head">
                    <CompactMarketplaceLogo marketplace={scenario.marketplace} size={42} />
                    <strong>{scenario.type}</strong>
                    {scenario.popular ? <span className="demo-scenario-popular">Популярный</span> : null}
                  </div>
                  <p>{scenario.text}</p>
                  <a href="#demo-process">Посмотреть пример →</a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section" id="demo-process">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Пример работы в MPReply</p>
              <h2>Одно обращение — весь процесс наглядно</h2>
              <p>Посмотрите, как меняется статус обращения на каждом этапе.</p>
            </div>

            <div className="demo-process">
              <div className="demo-process-message">
                <div className="demo-scenario-head">
                  <CompactMarketplaceLogo marketplace="oz" size={38} />
                  <div>
                    <strong>Обращение #45821</strong>
                    <small>12 мар 2024, 14:32</small>
                  </div>
                </div>
                <div className="demo-process-buyer-message">
                  <span className="demo-process-avatar" aria-hidden="true" />
                  <p>Добрый день! А этот товар будет в наличии на следующей неделе?</p>
                </div>
                <span className="demo-process-market-link">Открыть в маркетплейсе ↗</span>
              </div>

              <div className="demo-process-timeline">
                {processEvents.map(([icon, tone, status, time, label]) => (
                  <div className="demo-process-event" key={status}>
                    <span className={`demo-process-event-icon ${tone}`} aria-hidden="true">
                      <PublicIcon name={icon} />
                    </span>
                    <span className="demo-process-event-meta">
                      <small>{status}</small>
                      <time>{time}</time>
                    </span>
                    <strong>{label}</strong>
                  </div>
                ))}
              </div>

              <div className="demo-process-answer">
                <strong>
                  <PublicIcon name="message" className="public-inline-icon" /> Готовый ответ
                </strong>
                <p>
                  Добрый день! Ожидаем поставку на следующей неделе. Мы сообщим, как только товар снова
                  будет в наличии. Спасибо за ваш интерес! 💙
                </p>
                <span className="button button-secondary">Посмотреть полностью</span>
              </div>
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Больше, чем просто ответы</p>
              <h2>Что увидит ваша команда</h2>
              <p>Удобные инструменты для совместной работы и полного контроля.</p>
            </div>

            <div className="demo-team-tools">
              {teamTools.map(([icon, tone, title, text]) => (
                <article className="demo-team-tool" key={title}>
                  <span className={`mockup-icon-chip ${tone === "blue" ? "" : tone}`} aria-hidden="true">
                    <PublicIcon name={icon} />
                  </span>
                  <div>
                    <strong>{title}</strong>
                    <span>{text}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section public-cta-section">
          <div className="public-container">
            <div className="mockup-cta-strip demo-cta-strip">
              <span className="mockup-cta-strip-icon" aria-hidden="true">
                <PublicIcon name="send" />
              </span>
              <div className="mockup-cta-strip-copy">
                <h2>Попробуйте MPReply на своих обращениях</h2>
                <p>14 дней бесплатно. Ответы автоматически или после проверки.</p>
              </div>
              <div className="mockup-cta-strip-side">
                <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                  Попробовать бесплатно <span aria-hidden="true">→</span>
                </Link>
                <Link className="text-link" href="/marketplaces">
                  Посмотреть интеграции →
                </Link>
              </div>
              <span className="demo-cta-note" aria-hidden="true">
                Убедитесь в эффективности
                <br />
                уже сегодня!
              </span>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
