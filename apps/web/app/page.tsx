import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { HomeApprovedShell } from "../components/public-site/HomeApprovedShell";
import { HomeWorkspaceTabs } from "../components/public-site/HomeWorkspaceTabs";
import { JsonLd } from "../components/seo/JsonLd";
import { createPageMetadata } from "../lib/seo";
import { marketplaces, siteConfig } from "../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "ИИ-ответы для обращений покупателей на маркетплейсах",
  description:
    "MPReply собирает поддерживаемые обращения Wildberries, Ozon, Яндекс Маркета и Авито в одной очереди, готовит ИИ-черновики с контекстом и сохраняет контроль перед отправкой.",
  path: "/",
  localized: true,
});

const homeMarketplaceKeys = ["wildberries", "ozon", "yandex-market", "avito"] as const;
const homeMarketplaces = homeMarketplaceKeys.map((key) => marketplaces.find((marketplace) => marketplace.key === key)!).filter(Boolean);

const aiModels = [
  { name: "Контекст обращения", provider: "Текст и статус", mark: "◎", description: "ИИ использует содержание обращения и доступные данные рабочего процесса." },
  { name: "Контекст товара", provider: "Доступные данные товара", mark: "✺", description: "Черновик учитывает доступный товарный контекст вместо неподтверждённых предположений." },
  { name: "Настройки команды", provider: "Рабочее пространство", mark: "✦", description: "Подготовка ответа учитывает настройки рабочего пространства и сценарий обработки." },
  { name: "Контроль исключений", provider: "Правила и проверка", mark: "◒", description: "Неоднозначные случаи можно оставить на ручную проверку перед отправкой." },
] as const;

const resultFacts = [
  { icon: "◷", value: "4", label: "площадки в MPReply" },
  { icon: "▤", value: "1", label: "единая очередь обращений" },
  { icon: "ϟ", value: "14", label: "дней бесплатного доступа" },
  { icon: "◎", value: "2", label: "пути: автоматизация или проверка" },
] as const;

export default function HomePage() {
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "WebSite", name: siteConfig.name, url: siteConfig.origin, description: siteConfig.description, inLanguage: "ru-RU" },
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name: siteConfig.name, applicationCategory: "BusinessApplication", operatingSystem: "Web", description: siteConfig.description, url: siteConfig.origin },
  ];

  return (
    <HomeApprovedShell>
      <JsonLd data={jsonLd} />

      <section className="homepage-approved-hero home-reference-hero">
        <div className="home-reference-hero-shape home-reference-hero-shape-a" aria-hidden="true" />
        <div className="home-reference-hero-shape home-reference-hero-shape-b" aria-hidden="true" />
        <div className="public-container homepage-hero-grid">
          <div className="homepage-hero-copy">
            <p className="homepage-kicker homepage-pill-kicker">ИИ для продавцов на маркетплейсах</p>
            <h1>ИИ-ответы<br />для обращений<br />покупателей<br /><span>на маркетплейсах</span></h1>
            <p className="homepage-hero-lead">Собирайте поддерживаемые обращения Wildberries, Ozon, Яндекс Маркета и Авито в одной очереди. ИИ готовит черновики с доступным контекстом — с автоматизацией по правилам или проверкой перед отправкой.</p>
            <div className="homepage-hero-actions">
              <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">Попробовать бесплатно <span aria-hidden="true">→</span></Link>
              <Link className="button button-secondary homepage-demo-button" href="/demo"><span aria-hidden="true">▶</span>Посмотреть демо</Link>
            </div>
            <div className="homepage-hero-benefits" role="group" aria-label="Условия старта"><span>✓ Единая очередь</span><span>✓ 14 дней бесплатно</span><span>✓ Контроль перед отправкой</span></div>
          </div>
          <div className="homepage-hero-art home-reference-hero-art">
            <Image alt="Интерфейс MPReply с общей очередью обращений и ответом с помощью ИИ" height={450} priority sizes="(max-width: 1100px) 100vw, 50vw" src="/images/mpreply-hero-ui.webp" width={600} quality={85} />
          </div>
        </div>

        <div className="public-container homepage-approved-marketplaces home-reference-marketplaces" role="group" aria-labelledby="homepage-marketplaces-title">
          <div className="homepage-marketplaces-copy"><span>ПОДДЕРЖИВАЕМЫЕ ПЛОЩАДКИ</span><h2 id="homepage-marketplaces-title">Маркетплейсы</h2></div>
          <div className="homepage-marketplace-list">
            {homeMarketplaces.map((marketplace) => (
              <Link key={marketplace.key} className="homepage-marketplace-link" href={marketplace.path}>
                <span className={`homepage-marketplace-logo homepage-marketplace-logo-${marketplace.key}`} aria-hidden="true">{marketplace.mark}</span><strong>{marketplace.name}</strong>
              </Link>
            ))}
          </div>
          <div className="homepage-marketplace-facts" role="group" aria-label="Факты о продукте"><span><strong>4</strong><small>площадки в MPReply</small></span><span><strong>1</strong><small>единая очередь</small></span><span><strong>14</strong><small>дней бесплатного доступа</small></span></div>
        </div>
      </section>

      <section className="public-section homepage-workspace-section home-reference-workspace" id="product">
        <div className="public-container homepage-feature-layout">
          <div className="homepage-section-heading-left">
            <p className="homepage-kicker">ВСЕ ОБРАЩЕНИЯ В ОДНОМ ОКНЕ</p>
            <h2>Поддерживаемые обращения<br />в едином<br />пространстве</h2>
            <p>Работайте с доступными типами обращений, просматривайте контекст, используйте ИИ-черновики и сохраняйте контроль перед отправкой.</p>
            <Link className="button button-primary homepage-inline-cta" href="/demo">Посмотреть интерфейс&nbsp; →</Link>
          </div>
          <HomeWorkspaceTabs />
        </div>
      </section>

      <section className="public-section homepage-models-section home-reference-models">
        <div className="public-container homepage-models-layout">
          <div className="homepage-section-heading-left">
            <p className="homepage-kicker">ИИ С КОНТЕКСТОМ</p>
            <h2>Черновик ответа строится на доступном контексте</h2>
            <p>MPReply использует доступный контекст обращения, товара и рабочего пространства, а сложные случаи можно оставить на проверку.</p>
          </div>
          <div className="homepage-model-grid" role="group" aria-label="Механики подготовки ответа с ИИ">
            {aiModels.map((model, index) => (
              <article className={`homepage-model-card home-reference-model-card model-${index + 1}`} key={model.name}><span className="homepage-model-mark" aria-hidden="true">{model.mark}</span><strong>{model.name}</strong><small>{model.provider}</small><p>{model.description}</p></article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section homepage-approved-process home-reference-process" id="how-it-works">
        <div className="public-container">
          <div className="homepage-section-heading-left homepage-process-heading"><p className="homepage-kicker">ПРОСТОЙ И ПОНЯТНЫЙ ПРОЦЕСС</p><h2>Как это работает</h2><p>Подключите доступную площадку и ведите поддерживаемые обращения по одному рабочему процессу.</p></div>
          <ol className="homepage-horizontal-process">
            <li className="homepage-horizontal-step">
              <div className="homepage-horizontal-step-topline"><span className="homepage-process-number-circle">1</span><span className="homepage-process-connector" aria-hidden="true" /></div>
              <div className="homepage-process-card homepage-process-card-connect"><span className="homepage-process-card-icon" aria-hidden="true">↗</span><h3>Подключите<br />маркетплейсы</h3><p>Добавьте доступное подключение маркетплейса в рабочее пространство MPReply.</p><div className="homepage-process-marketplaces" aria-hidden="true"><b>WB</b><b>OZ</b><b>М</b><b>AV</b></div></div>
            </li>
            <li className="homepage-horizontal-step">
              <div className="homepage-horizontal-step-topline"><span className="homepage-process-number-circle">2</span><span className="homepage-process-connector" aria-hidden="true" /></div>
              <h3>Получайте обращения</h3><p>Поддерживаемые обращения из подключённых площадок появляются в единой очереди.</p><div className="homepage-process-card homepage-process-card-inbox" aria-hidden="true"><span><i>АК</i><b>Новый отзыв</b><small>2 мин назад</small></span><span><i>ИС</i><b>Новый вопрос</b><small>6 мин назад</small></span><span><i>МП</i><b>Новое сообщение</b><small>12 мин назад</small></span></div>
            </li>
            <li className="homepage-horizontal-step">
              <div className="homepage-horizontal-step-topline"><span className="homepage-process-number-circle">3</span><span className="homepage-process-connector" aria-hidden="true" /></div>
              <h3>ИИ готовит ответы</h3><p>С учётом товара, контекста и ваших правил.</p><div className="homepage-process-card homepage-process-card-ai" aria-hidden="true"><strong>✦ &nbsp; Ответ готов!</strong><span /><span /><span /></div>
            </li>
            <li className="homepage-horizontal-step">
              <div className="homepage-horizontal-step-topline"><span className="homepage-process-number-circle">4</span></div>
              <div className="homepage-process-card homepage-process-card-send"><span className="homepage-process-card-icon" aria-hidden="true">➤</span><h3>Отправляйте</h3><p>Автоматически или после проверки сотрудником.</p><div className="homepage-process-switches" aria-hidden="true"><span><b>✦ Автоотправка</b><i className="is-on" /></span><span><b>⌁ На проверке</b><i /></span><span><b>✓ Отправлено</b><i /></span></div></div>
            </li>
          </ol>
        </div>
      </section>

      <section className="public-section homepage-results-section home-reference-results">
        <div className="public-container homepage-results-layout">
          <div className="homepage-section-heading-left homepage-results-copy"><p className="homepage-kicker">ПРОВЕРЯЕМЫЕ МЕХАНИКИ</p><h2>Одна очередь.<br />Контекст рядом.<br />Контроль перед отправкой.</h2><p>MPReply объединяет поддерживаемые обращения, ИИ-черновики, правила автоматизации и ручную проверку в одном рабочем процессе.</p></div>
          <div className="homepage-result-grid">{resultFacts.map((fact) => (<article className="homepage-result-card" key={fact.label}><span aria-hidden="true">{fact.icon}</span><strong>{fact.value}</strong><p>{fact.label}</p></article>))}</div>
        </div>
      </section>

      <section className="public-section homepage-approved-final-cta home-reference-final">
        <div className="public-container homepage-final-cta-card">
          <div className="homepage-final-cta-copy"><p className="homepage-kicker">НАЧНИТЕ СЕГОДНЯ</p><h2>Автоматизируйте<br />коммуникацию с покупателями</h2><p>Попробуйте рабочий процесс MPReply бесплатно в течение 14 дней и проверьте его на доступном подключении.</p><div className="homepage-final-cta-actions"><Link className="button button-primary" href="/auth/register?intent=connect-marketplace">Попробовать бесплатно&nbsp; →</Link><Link className="button button-secondary homepage-demo-button" href="/demo"><span aria-hidden="true">▶</span> Посмотреть демо</Link></div><div className="homepage-final-benefits" role="group" aria-label="Условия старта"><span>✓ 14 дней бесплатно</span><span>✓ Единая очередь</span><span>✓ Контроль перед отправкой</span></div></div>
          <div className="homepage-cta-art home-reference-cta-art" aria-hidden="true"><Image alt="" height={450} sizes="(max-width: 760px) 100vw, 38vw" src="/images/mpreply-cta-ui.webp" width={600} quality={85} /></div>
        </div>
      </section>
    </HomeApprovedShell>
  );
}
