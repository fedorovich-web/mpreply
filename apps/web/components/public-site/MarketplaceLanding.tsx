import Image from "next/image";
import Link from "next/link";

import type { MarketplaceConfig, MarketplaceKey } from "../../lib/site-config";
import { PublicShell } from "./PublicShell";

type MarketplaceLandingProps = {
  marketplace: MarketplaceConfig;
};

const marketplaceLogos: Record<MarketplaceKey, { src: string; width: number; height: number }> = {
  wildberries: { src: "/images/marketplaces/wildberries.webp", width: 432, height: 188 },
  ozon: { src: "/images/marketplaces/ozon.webp", width: 436, height: 198 },
  "yandex-market": { src: "/images/marketplaces/yandex-market.webp", width: 554, height: 222 },
  avito: { src: "/images/marketplaces/avito.webp", width: 504, height: 212 },
};

export function MarketplaceLanding({ marketplace }: MarketplaceLandingProps) {
  const platformLabel = marketplace.name === "Wildberries" ? "WILDBERRIES" : marketplace.name.toUpperCase();
  const logo = marketplaceLogos[marketplace.key];

  const toolCards = [
    ["✉", "blue", "Единая очередь обращений", `Все отзывы, вопросы и сообщения с ${marketplace.name} в одном удобном интерфейсе.`],
    ["✦", "purple", "AI-черновик ответа", "Искусственный интеллект готовит вежливые, точные и персонализированные черновики ответов."],
    ["✓", "green", "Контроль качества", `Проверка тональности, грамотности и соответствия правилам ${marketplace.name}.`],
    ["◷", "purple", "История действий", "Полная история обращений и действий сотрудников для прозрачности и контроля."],
  ] as const;

  const steps = [
    ["1", "↗", `Подключите ${marketplace.name}`, `Авторизуйтесь через официальный API ${marketplace.name}. Это займет пару минут.`],
    ["2", "⚙", "Настройте параметры", "Выберите магазины, установите роли сотрудников и настройте уведомления."],
    ["3", "▤", "Используйте AI и шаблоны", "AI подготовит черновики, а шаблоны помогут отвечать ещё быстрее."],
    ["4", "▥", "Получайте результат", "Обрабатывайте больше обращений, повышайте рейтинг и лояльность покупателей."],
  ] as const;

  const dailyBenefits = [
    ["ϟ", "orange", "Больше скорости", "Отвечайте на обращения быстрее и не теряйте покупателей."],
    ["●", "purple", "Прозрачность работы", "Видите, кто и на что отвечает. Контролируйте нагрузку и качество."],
    ["▤", "blue", "Удобные шаблоны", "Создавайте и сохраняйте шаблоны ответов для типовых ситуаций."],
    ["▥", "blue", "Полезная аналитика", "Следите за рейтингом, динамикой отзывов и скоростью ответов. Принимайте решения на основе данных."],
  ] as const;

  const faq = [
    [`Как подключить ${marketplace.name}?`, `Подключение занимает несколько минут через официальный API ${marketplace.name}.`],
    ["Можно ли добавить несколько сотрудников?", "Да. Вы можете настроить роли и права доступа для всей команды."],
    ["Обновляются ли статусы обращений?", "Да. Статусы синхронизируются автоматически в реальном времени."],
  ] as const;

  return (
    <PublicShell>
      <div className="mockup-page">
        <section className="marketplace-detail-mockup-hero">
          <div className="public-container marketplace-detail-mockup-grid">
            <div className="marketplace-detail-mockup-copy">
              <p className="mockup-eyebrow">{platformLabel} + MPReply</p>
              <h1>Работайте с отзывами, вопросами и сообщениями {marketplace.name} быстрее</h1>
              <p>
                Подключите {marketplace.name} к MPReply и обрабатывайте все обращения покупателей в одном месте — с помощью AI, шаблонов и удобной командной работы.
              </p>
              <div className="mockup-actions">
                <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                  Подключить {marketplace.name} бесплатно <span aria-hidden="true">→</span>
                </Link>
                <Link className="button button-secondary" href="/demo">Смотреть видео</Link>
              </div>
              <div className="mockup-trust-row">
                <span>14 дней бесплатно</span>
                <span>Быстрое подключение</span>
                <span>Без карты</span>
              </div>
            </div>

            <div className="marketplace-detail-render" role="img" aria-label={`Обработка обращения ${marketplace.name} в MPReply`}>
              <div className="detail-market-card">
                <div className="detail-market-logo">
                  <Image className="marketplace-detail-logo" src={logo.src} width={logo.width} height={logo.height} alt={marketplace.name} unoptimized />
                </div>
                <div className="detail-market-message">
                  <strong>Покупатель · 12 мин назад</strong>
                  Здравствуйте! Когда будет поставка этого товара?
                </div>
                <div className="detail-product-row">
                  <span className="detail-product-thumb" aria-hidden="true" />
                  <span>Кроссовки женские<br />Арт. 12345678</span>
                </div>
              </div>

              <div className="detail-app-window">
                <div className="detail-app-top"><span aria-hidden="true">▰</span> MPReply</div>
                <div className="detail-app-body">
                  <aside className="detail-sidebar" aria-hidden="true">
                    <strong>Все обращения · 24</strong>
                    <span>Отзывы · 6</span>
                    <span>Вопросы · 8</span>
                    <span>Сообщения · 10</span>
                    <span>Аналитика</span>
                    <span>Шаблоны</span>
                    <span>Команда</span>
                  </aside>
                  <div className="detail-question">
                    <div className="detail-question-top">
                      <Image className="marketplace-detail-logo-small" src={logo.src} width={logo.width} height={logo.height} alt="" aria-hidden="true" unoptimized />
                      <strong>Вопрос</strong>
                      <span>12 мин назад</span>
                    </div>
                    <h3>Здравствуйте! Когда будет поставка этого товара?</h3>
                    <p>Контекст товара и обращения уже доступен в рабочем окне.</p>
                  </div>
                </div>
              </div>

              <div className="detail-ai-card">
                <strong>AI ✦</strong>
                <p>Здравствуйте! Поставка ожидается в ближайшее время. Мы сообщим, как только товар появится на складе.</p>
                <span>Использовать ответ</span>
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
              <p>MPReply объединяет обращения с {marketplace.name} и даёт вашей команде инструменты для быстрой, качественной и удобной обработки.</p>
            </div>
            <div className="marketplace-detail-tools">
              {toolCards.map(([icon, tone, title, text]) => (
                <article className="detail-tool-card" key={title}>
                  <span className={`mockup-icon-chip ${tone === "blue" ? "" : tone}`} aria-hidden="true">{icon}</span>
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
                  <span className={`mockup-icon-chip ${index === 1 ? "purple" : ""}`} aria-hidden="true">{icon}</span>
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
                  <span className={`mockup-icon-chip ${tone === "blue" ? "" : tone}`} aria-hidden="true">{icon}</span>
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
              {faq.map(([question, answer]) => (
                <details key={question}>
                  <summary>{question}</summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section public-cta-section">
          <div className="public-container">
            <div className="detail-cta-bar">
              <div>
                <h2>Начните работать с {marketplace.name} уже сегодня</h2>
                <p>14 дней бесплатного доступа ко всем возможностям. Без карты. Без риска.</p>
              </div>
              <div className="mockup-actions">
                <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                  Подключить {marketplace.name} бесплатно <span aria-hidden="true">→</span>
                </Link>
              </div>
              <div className="mockup-trust-row" aria-label="Условия старта">
                <span>Быстрое подключение</span>
                <span>Полный доступ</span>
                <span>Поддержка 24/7</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
