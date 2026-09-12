import type { Metadata } from "next";
import Link from "next/link";

import { HomeHeroScene } from "../components/public-site/HomeHeroScene";
import { HomeWorkspaceTabs } from "../components/public-site/HomeWorkspaceTabs";
import { PublicShell } from "../components/public-site/PublicShell";
import { JsonLd } from "../components/seo/JsonLd";
import { createPageMetadata } from "../lib/seo";
import { marketplaces, siteConfig } from "../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Автоответы на отзывы, вопросы и сообщения покупателей",
  description:
    "MPReply собирает отзывы, вопросы и сообщения покупателей с Wildberries, Ozon, Яндекс Маркета и Авито в одном окне, готовит ответы с помощью ИИ и автоматизирует отправку.",
  path: "/",
});

const replyContext = [
  {
    mark: "◎",
    title: "Контекст товара",
    meta: "Анализ карточки и обращения",
    description: "Учитывает товар и доступный контекст диалога.",
    tone: "blue",
  },
  {
    mark: "✺",
    title: "Стиль бренда",
    meta: "Тональность ответа",
    description: "Сохраняет единый стиль общения с покупателями.",
    tone: "orange",
  },
  {
    mark: "✦",
    title: "Правила команды",
    meta: "Управляемая автоматизация",
    description: "Следует заданным правилам подготовки и отправки.",
    tone: "violet",
  },
  {
    mark: "◉",
    title: "Контроль перед отправкой",
    meta: "Сложные случаи — менеджеру",
    description: "Останавливает сценарий, когда требуется проверка человека.",
    tone: "indigo",
  },
] as const;

const resultFacts = [
  { icon: "◷", value: "4", label: "маркетплейса подключаются к единой очереди" },
  { icon: "▤", value: "3", label: "типа обращений в одном рабочем окне" },
  { icon: "ϟ", value: "2", label: "режима отправки: автоматически или после проверки" },
  { icon: "◎", value: "1", label: "единый процесс для нескольких кабинетов" },
] as const;

export default function HomePage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteConfig.name,
      url: siteConfig.origin,
      description: siteConfig.description,
      inLanguage: "ru-RU",
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: siteConfig.name,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: siteConfig.description,
      url: siteConfig.origin,
    },
  ];

  return (
    <PublicShell>
      <JsonLd data={jsonLd} />

      <section className="homepage-hero homepage-approved-hero">
        <div className="homepage-hero-decoration homepage-hero-decoration-a" aria-hidden="true" />
        <div className="homepage-hero-decoration homepage-hero-decoration-b" aria-hidden="true" />
        <div className="public-container homepage-hero-grid">
          <div className="homepage-hero-copy">
            <p className="homepage-kicker homepage-pill-kicker">ИИ для продавцов на маркетплейсах</p>
            <h1>
              Автоответы<br />на отзывы, вопросы<br />и сообщения<br /><span>покупателей</span>
            </h1>
            <p className="homepage-hero-lead">
              Собирайте обращения с Wildberries, Ozon, Яндекс Маркета и Авито в одном окне. ИИ готовит ответы с учётом товара и стиля вашего бренда — автоматически или после проверки.
            </p>
            <div className="homepage-hero-actions">
              <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                Попробовать бесплатно <span aria-hidden="true">→</span>
              </Link>
              <Link className="button button-secondary homepage-demo-button" href="/demo">
                <span aria-hidden="true">▶</span>
                Посмотреть демо
              </Link>
            </div>
            <div className="homepage-hero-benefits" role="group" aria-label="Основные преимущества">
              <span>✓ Быстрое подключение</span>
              <span>✓ Контроль перед отправкой</span>
              <span>✓ Без лишних переходов</span>
            </div>
          </div>

          <HomeHeroScene />
        </div>

        <div className="public-container homepage-approved-marketplaces" role="group" aria-labelledby="homepage-marketplaces-title">
          <div className="homepage-marketplaces-copy">
            <span>Поддерживаем ведущие маркетплейсы</span>
            <h2 id="homepage-marketplaces-title">Маркетплейсы</h2>
          </div>
          <div className="homepage-marketplace-list">
            {marketplaces.map((marketplace) => (
              <Link key={marketplace.key} className="homepage-marketplace-link" href={marketplace.path}>
                <span className={`homepage-marketplace-logo homepage-marketplace-logo-${marketplace.key}`} aria-hidden="true">
                  {marketplace.key === "yandex-market" ? "M" : marketplace.key === "avito" ? "A" : marketplace.shortName.slice(0, 2)}
                </span>
                <strong>{marketplace.name}</strong>
              </Link>
            ))}
          </div>
          <div className="homepage-marketplace-facts" role="group" aria-label="Факты о продукте">
            <span><strong>4</strong><small>маркетплейса</small></span>
            <span><strong>1</strong><small>единое окно</small></span>
            <span><strong>3</strong><small>типа обращений</small></span>
          </div>
        </div>
      </section>

      <section className="public-section homepage-workspace-section" id="product">
        <div className="public-container homepage-feature-layout">
          <div className="homepage-section-heading homepage-section-heading-left">
            <p className="homepage-kicker">Все обращения в одном окне</p>
            <h2>Отзывы, вопросы и сообщения — в едином пространстве</h2>
            <p>
              Переключайтесь между типами обращений, просматривайте контекст, используйте ИИ и отправляйте ответы в несколько кликов.
            </p>
            <Link className="button button-primary homepage-inline-cta" href="/demo">
              Посмотреть интерфейс&nbsp; →
            </Link>
          </div>
          <HomeWorkspaceTabs />
        </div>
      </section>

      <section className="public-section homepage-context-section homepage-models-section">
        <div className="public-container homepage-models-layout">
          <div className="homepage-section-heading homepage-section-heading-left">
            <p className="homepage-kicker">Сила современного ИИ</p>
            <h2>Используем лучшие нейросети для точных и естественных ответов</h2>
            <p>
              MPReply учитывает контекст товара, обращение, стиль бренда и правила команды, чтобы ответы оставались полезными, последовательными и управляемыми.
            </p>
          </div>
          <div className="homepage-model-grid" role="group" aria-label="Контекст подготовки ответа">
            {replyContext.map((item) => (
              <div className={`homepage-model-card is-${item.tone}`} key={item.title}>
                <span className="homepage-model-mark" aria-hidden="true">{item.mark}</span>
                <strong>{item.title}</strong>
                <small>{item.meta}</small>
                <p>{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section homepage-process homepage-approved-process" id="how-it-works">
        <div className="public-container">
          <div className="homepage-section-heading homepage-section-heading-left homepage-process-heading">
            <p className="homepage-kicker">Простой и понятный процесс</p>
            <h2>Как это работает</h2>
            <p>Подключите маркетплейсы и начните экономить время уже с первой общей очереди.</p>
          </div>

          <ol className="homepage-horizontal-process">
            <li className="homepage-horizontal-step">
              <div className="homepage-horizontal-step-topline"><span className="homepage-process-number-circle">1</span><span className="homepage-process-connector" aria-hidden="true" /></div>
              <div className="homepage-process-card homepage-process-card-connect">
                <span className="homepage-process-card-icon" aria-hidden="true">↗</span>
                <h3>Подключите маркетплейсы</h3>
                <p>Добавьте кабинеты Wildberries, Ozon, Яндекс Маркета и Авито.</p>
                <div className="homepage-process-marketplaces" aria-hidden="true"><b>WB</b><b>OZ</b><b>М</b><b>A</b></div>
              </div>
            </li>
            <li className="homepage-horizontal-step">
              <div className="homepage-horizontal-step-topline"><span className="homepage-process-number-circle">2</span><span className="homepage-process-connector" aria-hidden="true" /></div>
              <h3>Получайте обращения</h3>
              <p>Все отзывы, вопросы и сообщения собираются в единую очередь.</p>
              <div className="homepage-process-card homepage-process-card-inbox" aria-hidden="true">
                <span><i>АК</i><b>Новый отзыв</b><small>2 мин назад</small></span>
                <span><i>ИС</i><b>Новый вопрос</b><small>6 мин назад</small></span>
                <span><i>МП</i><b>Новое сообщение</b><small>12 мин назад</small></span>
              </div>
            </li>
            <li className="homepage-horizontal-step">
              <div className="homepage-horizontal-step-topline"><span className="homepage-process-number-circle">3</span><span className="homepage-process-connector" aria-hidden="true" /></div>
              <h3>ИИ готовит ответы</h3>
              <p>С учётом товара, контекста обращения и правил вашей команды.</p>
              <div className="homepage-process-card homepage-process-card-ai" aria-hidden="true"><strong>✦ &nbsp; Ответ готов!</strong><span /><span /><span /></div>
            </li>
            <li className="homepage-horizontal-step">
              <div className="homepage-horizontal-step-topline"><span className="homepage-process-number-circle">4</span></div>
              <div className="homepage-process-card homepage-process-card-send">
                <span className="homepage-process-card-icon" aria-hidden="true">➤</span>
                <h3>Отправляйте</h3>
                <p>Автоматически или после проверки сотрудником.</p>
                <div className="homepage-process-switches" aria-hidden="true"><span><b>✦ Автоотправка</b><i className="is-on" /></span><span><b>⌁ На проверке</b><i /></span><span><b>✓ Отправлено</b><i /></span></div>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="public-section homepage-results-section">
        <div className="public-container homepage-results-layout">
          <div className="homepage-section-heading homepage-section-heading-left homepage-results-copy">
            <p className="homepage-kicker">Реальные возможности продукта</p>
            <h2>Меньше рутины. Больше времени на развитие бизнеса.</h2>
            <p>
              Автоматизируйте повторяющиеся обращения и сосредоточьтесь на товарах и клиентах, где действительно нужен человек.
            </p>
          </div>
          <div className="homepage-result-grid">
            {resultFacts.map((fact) => (
              <div className="homepage-result-card" key={fact.label}>
                <span aria-hidden="true">{fact.icon}</span>
                <strong>{fact.value}</strong>
                <p>{fact.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section homepage-final-cta homepage-approved-final-cta">
        <div className="public-container homepage-final-cta-card">
          <div className="homepage-final-cta-copy">
            <p className="homepage-kicker">Начните сегодня</p>
            <h2>Автоматизируйте коммуникацию с покупателями</h2>
            <p>Подключите маркетплейсы и попробуйте рабочий процесс MPReply на своих обращениях.</p>
            <div className="homepage-final-cta-actions">
              <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">Попробовать бесплатно&nbsp; →</Link>
              <Link className="button button-secondary homepage-demo-button" href="/demo"><span aria-hidden="true">▶</span> Посмотреть демо</Link>
            </div>
            <div className="homepage-final-benefits" role="group" aria-label="Преимущества подключения"><span>✓ Без карты</span><span>✓ Контроль автоматизации</span><span>✓ Быстрое подключение</span></div>
          </div>
          <div className="homepage-cta-scene" aria-hidden="true">
            <div className="homepage-cta-stack homepage-cta-stack-a"><b>WB</b><span /><span /><span /></div>
            <div className="homepage-cta-stack homepage-cta-stack-b"><b>OZ</b><span /><span /><span /></div>
            <div className="homepage-cta-stack homepage-cta-stack-c"><b>М</b><span /><span /><span /></div>
            <div className="homepage-cta-stack homepage-cta-stack-d"><b>A</b><span /><span /><span /></div>
            <div className="homepage-cta-bubble">Больше времени<br />на развитие бизнеса</div>
            <div className="homepage-cta-add">+</div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}