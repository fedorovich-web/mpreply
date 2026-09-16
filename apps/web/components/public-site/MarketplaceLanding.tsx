import Image from "next/image";
import Link from "next/link";

import type { MarketplaceConfig, MarketplaceKey } from "../../lib/site-config";
import { PublicBrandMark } from "./PublicBrandMark";
import { PublicIcon, type PublicIconName } from "./PublicIcon";
import { PublicShell } from "./PublicShell";

type MarketplaceLandingProps = {
  marketplace: MarketplaceConfig;
};

type Tone = "blue" | "purple" | "green" | "orange";

const marketplaceLogos: Record<MarketplaceKey, { src: string; compactSrc: string; width: number; height: number }> = {
  wildberries: {
    src: "/images/marketplaces/wildberries.webp",
    compactSrc: "/images/marketplaces/wildberries-compact.webp",
    width: 432,
    height: 188,
  },
  ozon: {
    src: "/images/marketplaces/ozon.webp",
    compactSrc: "/images/marketplaces/ozon-compact.webp",
    width: 436,
    height: 198,
  },
  "yandex-market": {
    src: "/images/marketplaces/yandex-market.webp",
    compactSrc: "/images/marketplaces/yandex-market-compact.webp",
    width: 554,
    height: 222,
  },
  avito: {
    src: "/images/marketplaces/avito.webp",
    compactSrc: "/images/marketplaces/avito-compact.webp",
    width: 504,
    height: 212,
  },
};

export function MarketplaceLanding({ marketplace }: MarketplaceLandingProps) {
  const platformLabel = marketplace.name === "Wildberries" ? "WILDBERRIES" : marketplace.name.toUpperCase();
  const logo = marketplaceLogos[marketplace.key];

  const toolCards: readonly [PublicIconName, Tone, string, string][] = [
    [
      "inbox",
      "blue",
      "Единая очередь обращений",
      `Доступные отзывы, вопросы и сообщения с ${marketplace.name} в одном удобном интерфейсе.`,
    ],
    [
      "sparkles",
      "purple",
      "AI-черновик ответа",
      "Искусственный интеллект готовит вежливые, точные и персонализированные черновики ответов.",
    ],
    [
      "shield-check",
      "green",
      "Контроль качества",
      `Проверка тональности, грамотности и соответствия правилам ${marketplace.name}.`,
    ],
    [
      "clock",
      "purple",
      "История действий",
      "История обращений и действий сотрудников помогает сохранять прозрачность работы команды.",
    ],
  ];

  const steps: readonly [string, PublicIconName, string, string][] = [
    [
      "1",
      "link",
      `Подключите ${marketplace.name}`,
      `Авторизуйтесь через доступный способ подключения ${marketplace.name}.`,
    ],
    [
      "2",
      "gear",
      "Настройте параметры",
      "Выберите магазины, установите роли сотрудников и настройте уведомления.",
    ],
    [
      "3",
      "document",
      "Используйте AI и шаблоны",
      "AI подготовит черновики, а шаблоны помогут отвечать ещё быстрее.",
    ],
    [
      "4",
      "chart",
      "Получайте результат",
      "Работайте с обращениями в одной очереди, сохраняйте статусы и историю действий команды.",
    ],
  ];

  const dailyBenefits: readonly [PublicIconName, Tone, string, string][] = [
    ["lightning", "orange", "Больше скорости", "Отвечайте на обращения быстрее и сокращайте ручную рутину."],
    [
      "users",
      "purple",
      "Прозрачность работы",
      "Видите, кто и на что отвечает. Контролируйте нагрузку и качество.",
    ],
    [
      "document",
      "blue",
      "Удобные шаблоны",
      "Создавайте и сохраняйте шаблоны ответов для типовых ситуаций.",
    ],
    [
      "chart",
      "blue",
      "Полезная аналитика",
      "Следите за рейтингом, динамикой отзывов и скоростью ответов. Принимайте решения на основе данных.",
    ],
  ];

  const faq: readonly [PublicIconName, string, string][] = [
    [
      "link",
      `Как подключить ${marketplace.name}?`,
      `Подключение выполняется через доступный для интеграции способ авторизации ${marketplace.name}.`,
    ],
    [
      "users",
      "Можно ли добавить несколько сотрудников?",
      "Да. Вы можете настроить роли и права доступа для всей команды.",
    ],
    [
      "shield-check",
      "Обновляются ли статусы обращений?",
      "Да. MPReply синхронизирует доступные статусы обращений через интеграцию.",
    ],
  ];

  return (
    <PublicShell>
      <div className="mockup-page">
        <section className="marketplace-detail-mockup-hero">
          <div className="public-container marketplace-detail-mockup-grid">
            <div className="marketplace-detail-mockup-copy">
              <p className="mockup-eyebrow">{platformLabel} + MPReply</p>
              <h1>Работайте с обращениями {marketplace.name} быстрее</h1>
              <p>
                Подключите {marketplace.name} к MPReply и обрабатывайте доступные обращения покупателей в одном
                месте — с помощью AI, шаблонов и удобной командной работы.
              </p>
              <div className="mockup-actions">
                <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                  Подключить {marketplace.name} бесплатно <span aria-hidden="true">→</span>
                </Link>
                <Link className="button button-secondary" href="/demo">
                  <PublicIcon name="play" className="public-inline-icon" /> Смотреть видео
                </Link>
              </div>
              <div className="mockup-trust-row">
                <span>14 дней бесплатно</span>
                <span>Быстрое подключение</span>
                <span>Без карты</span>
              </div>
            </div>

            <div
              className="marketplace-detail-render"
              role="img"
              aria-label={`Обработка обращения ${marketplace.name} в MPReply`}
            >
              <div className="detail-market-card">
                <div className="detail-market-logo">
                  <Image
                    className="marketplace-detail-logo"
                    src={logo.src}
                    width={logo.width}
                    height={logo.height}
                    alt={marketplace.name}
                    unoptimized
                  />
                </div>
                <div className="detail-market-message">
                  <strong>Покупатель · 12 мин назад</strong>
                  Здравствуйте! Когда будет поставка этого товара?
                </div>
                <div className="detail-product-row">
                  <span className="detail-product-thumb" aria-hidden="true" />
                  <span>
                    Кроссовки женские
                    <br />
                    Арт. 12345678
                  </span>
                </div>
              </div>

              <div className="detail-app-window">
                <div className="detail-app-top">
                  <div className="detail-app-brand">
                    <PublicBrandMark />
                    <strong>MPReply</strong>
                  </div>
                </div>
                <div className="detail-app-body">
                  <aside className="detail-sidebar" aria-hidden="true">
                    <strong className="detail-sidebar-item is-active">
                      <PublicIcon name="inbox" />
                      Все обращения
                      <b>24</b>
                    </strong>
                    <span className="detail-sidebar-item"><PublicIcon name="message" />Отзывы <b>6</b></span>
                    <span className="detail-sidebar-item"><PublicIcon name="message" />Вопросы <b>8</b></span>
                    <span className="detail-sidebar-item"><PublicIcon name="message" />Сообщения <b>10</b></span>
                    <span className="detail-sidebar-item"><PublicIcon name="chart" />Аналитика</span>
                    <span className="detail-sidebar-item"><PublicIcon name="archive" />Шаблоны</span>
                    <span className="detail-sidebar-item"><PublicIcon name="users" />Команда</span>
                  </aside>
                  <div className="detail-question">
                    <div className="detail-question-top">
                      <Image
                        className="marketplace-detail-compact-logo"
                        src={logo.compactSrc}
                        width={64}
                        height={64}
                        alt=""
                        aria-hidden="true"
                        unoptimized
                      />
                      <strong>Вопрос</strong>
                      <span>12 мин назад</span>
                    </div>
                    <h3>Здравствуйте! Когда будет поставка этого товара?</h3>
                    <p>Контекст товара и обращения уже доступен в рабочем окне.</p>
                  </div>
                </div>
              </div>

              <div className="detail-ai-card">
                <strong>
                  <PublicIcon name="sparkles" className="public-inline-icon" /> AI
                </strong>
                <p>
                  Здравствуйте! Поставка ожидается в ближайшее время. Мы сообщим, как только товар появится
                  на складе.
                </p>
                <span>Использовать ответ</span>
              </div>

              <div className="detail-hero-note" aria-hidden="true">
                Все обращения
                <br />
                с {marketplace.name}
                <br />
                в одном окне
                <span>↙</span>
              </div>
              <div className="mockup-mascot detail-render-mascot" aria-hidden="true" />
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Возможности интеграции</p>
              <h2>Всё, что нужно для работы с {marketplace.name}</h2>
              <p>
                MPReply объединяет обращения с {marketplace.name} и даёт вашей команде инструменты для быстрой,
                качественной и удобной обработки.
              </p>
            </div>
            <div className="marketplace-detail-tools">
              {toolCards.map(([icon, tone, title, text]) => (
                <article className="detail-tool-card" key={title}>
                  <span className={`mockup-icon-chip ${tone === "blue" ? "" : tone}`} aria-hidden="true">
                    <PublicIcon name={icon} />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Как это работает</p>
              <h2>От подключения до первых ответов</h2>
              <p>Подключите {marketplace.name} и начните обрабатывать обращения всего за несколько шагов.</p>
            </div>
            <div className="marketplace-detail-steps">
              {steps.map(([number, icon, title, text], index) => (
                <article className="detail-step-card" key={number}>
                  <span className="detail-step-number">{number}</span>
                  <span className={`mockup-icon-chip ${index === 1 ? "purple" : ""}`} aria-hidden="true">
                    <PublicIcon name={icon} />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Что получает команда</p>
              <h2>Эффективная работа каждый день</h2>
              <p>Инструменты MPReply помогают вашей команде экономить время и достигать лучших результатов.</p>
            </div>
            <div className="marketplace-detail-benefits">
              {dailyBenefits.map(([icon, tone, title, text]) => (
                <article className="detail-benefit-card" key={title}>
                  <span className={`mockup-icon-chip ${tone === "blue" ? "" : tone}`} aria-hidden="true">
                    <PublicIcon name={icon} />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container detail-faq-layout">
            <div>
              <p className="mockup-eyebrow">Готовы к подключению?</p>
              <h2>Частые вопросы</h2>
              <p>Подключение {marketplace.name} к MPReply — это просто и безопасно.</p>
            </div>
            <div className="marketplace-detail-faq">
              {faq.map(([icon, question, answer]) => (
                <details key={question}>
                  <summary className="detail-faq-summary">
                    <span className="detail-faq-icon" aria-hidden="true">
                      <PublicIcon name={icon} />
                    </span>
                    <span>{question}</span>
                    <span className="detail-faq-chevron" aria-hidden="true">⌄</span>
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section public-cta-section">
          <div className="public-container">
            <div className="mockup-cta-strip">
              <span className="mockup-cta-strip-icon" aria-hidden="true">
                <PublicIcon name="send" />
              </span>
              <div className="mockup-cta-strip-copy">
                <h2>Начните работать с {marketplace.name} уже сегодня</h2>
                <p>14 дней бесплатного доступа. Без карты.</p>
              </div>
              <div className="mockup-cta-strip-side">
                <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                  Подключить {marketplace.name} бесплатно <span aria-hidden="true">→</span>
                </Link>
                <div className="mockup-trust-row" aria-label="Условия старта">
                  <span>Быстрое подключение</span>
                  <span>Полный доступ</span>
                  <span>Поддержка ежедневно</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
