import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PublicIcon, type PublicIconName } from "../../components/public-site/PublicIcon";
import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Демо MPReply — как работает обработка обращений",
  description:
    "Посмотрите демонстрационный сценарий: MPReply получает обращение, использует доступный контекст, готовит ИИ-черновик и передаёт ответ на проверку или отправку.",
  path: "/demo",
  localized: true,
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
    "Отзыв, вопрос или поддерживаемое сообщение синхронизируется из подключённого маркетплейса в очередь MPReply.",
  ],
  [
    "document",
    "Анализ контекста",
    "MPReply использует текст обращения, доступный контекст товара и настройки рабочего пространства.",
  ],
  [
    "sparkles",
    "ИИ-черновик",
    "ИИ готовит черновик ответа на основе доступного контекста и настроек рабочего пространства.",
  ],
  [
    "send",
    "Проверка и отправка",
    "Ответ можно проверить и отредактировать перед отправкой либо обработать автоматически, если это разрешают правила.",
  ],
];

const scenarios = [
  {
    marketplace: "wb" as MarketplaceLogoKey,
    type: "Отзыв",
    popular: true,
    text: "Покупатель оставил отзыв на товар. Посмотрите, как MPReply ведёт его через очередь, черновик и проверку.",
  },
  {
    marketplace: "oz" as MarketplaceLogoKey,
    type: "Вопрос",
    popular: false,
    text: "Покупатель задаёт вопрос о товаре, доставке или наличии. MPReply готовит черновик только на основе доступного контекста.",
  },
  {
    marketplace: "ym" as MarketplaceLogoKey,
    type: "Сообщение",
    popular: false,
    text: "Сообщение покупателя попадает в общую очередь, где видны его текст, статус и доступный контекст товара.",
  },
] as const;

const processEvents: readonly [PublicIconName, "green" | "blue" | "purple", string, string, string][] = [
  ["download", "green", "Получено", "12 мар, 14:32", "Демо: обращение получено из Ozon"],
  ["search", "blue", "Контекст", "12 мар, 14:32", "Демо: учтён доступный контекст обращения и товара"],
  ["sparkles", "purple", "ИИ-черновик", "12 мар, 14:33", "Черновик подготовлен и передан на проверку"],
  ["users", "purple", "Проверено", "12 мар, 14:34", "Ответ проверен сотрудником"],
  ["check-circle", "green", "Отправлено", "12 мар, 14:35", "Демо: показан итоговый статус после отправки"],
];

const teamTools: readonly [PublicIconName, "blue" | "purple" | "orange", string, string][] = [
  [
    "users",
    "purple",
    "Единая очередь обращений",
    "Отзывы, вопросы и поддерживаемые сообщения из подключённых маркетплейсов собраны в одном рабочем пространстве.",
  ],
  [
    "users",
    "blue",
    "Назначение обращений",
    "Берите обращения в работу и отделяйте назначенные вам обращения от общей очереди.",
  ],
  [
    "lightning",
    "orange",
    "Автоматизация по правилам",
    "Настраивайте условия автоматической обработки и оставляйте неоднозначные случаи на проверку.",
  ],
  [
    "chart",
    "blue",
    "Аналитика",
    "Смотрите объём обращений, отправленные ответы, время реакции и данные по подключённым площадкам.",
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
                Демонстрационный сценарий: покупатель пишет в маркетплейсе, MPReply собирает доступный
                контекст, ИИ готовит черновик, а дальше ответ проходит проверку или правила автоматизации.
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
                <span>ИИ-черновик с контекстом</span>
              </div>
            </div>

            <div
              className="demo-hero-story"
              role="img"
              aria-label="Демонстрационный путь обращения от покупателя до черновика и проверки"
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
                    <strong>ИИ MPReply</strong>
                    <small>Предлагает черновик</small>
                  </div>
                </div>
                <p>
                  Здравствуйте! Точная дата следующей поставки в доступном контексте не указана. Когда
                  товар снова появится, актуальный статус будет виден в карточке товара. Спасибо за интерес!
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
                    <small>Проверяете перед отправкой</small>
                  </div>
                </div>
                <div className="demo-story-review-bubble">
                  <strong>Черновик проверен</strong>
                  <span>Можно отправить →</span>
                </div>
              </article>
              <div className="demo-hero-note" aria-hidden="true">
                Контекст
                <br />
                черновик
                <br />
                проверка
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
              <p>От сообщения покупателя до отправки или ручной проверки — четыре понятных этапа.</p>
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
                    <div className="demo-journey-marketplaces" aria-label="Поддерживаемые интеграции маркетплейсов">
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
              <p className="mockup-eyebrow">Пример сценария</p>
              <h2>Посмотрите разные типы обращений</h2>
              <p>Это демонстрационные примеры интерфейса, а не статистика или клиентские кейсы.</p>
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
                    {scenario.popular ? <span className="demo-scenario-popular">Пример</span> : null}
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
              <p className="mockup-eyebrow">Демонстрационный сценарий</p>
              <h2>Одно обращение — весь процесс наглядно</h2>
              <p>Статический пример показывает, как могут меняться состояния обращения в MPReply.</p>
            </div>

            <div className="demo-process">
              <div className="demo-process-message">
                <div className="demo-scenario-head">
                  <CompactMarketplaceLogo marketplace="oz" size={38} />
                  <div>
                    <strong>Демо-обращение #45821</strong>
                    <small>12 мар, 14:32</small>
                  </div>
                </div>
                <div className="demo-process-buyer-message">
                  <span className="demo-process-avatar" aria-hidden="true" />
                  <p>Добрый день! А этот товар будет в наличии на следующей неделе?</p>
                </div>
                <span className="demo-process-market-link">Контекст маркетплейса ↗</span>
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
                  <PublicIcon name="message" className="public-inline-icon" /> Черновик ответа
                </strong>
                <p>
                  Добрый день! Точная дата следующей поставки в доступном контексте не указана. Когда
                  товар снова появится, актуальный статус будет виден в карточке товара. Спасибо за интерес!
                </p>
                <span className="button button-secondary">Показан полностью</span>
              </div>
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Рабочие инструменты</p>
              <h2>Что доступно команде</h2>
              <p>Очередь, назначения, правила автоматизации и аналитика собраны вокруг обработки обращений.</p>
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
                Посмотрите процесс
                <br />
                на своих обращениях
              </span>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
