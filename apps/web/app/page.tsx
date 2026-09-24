import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { HomeApprovedShell } from "../components/public-site/HomeApprovedShell";
import { HomeWorkspaceTabs } from "../components/public-site/HomeWorkspaceTabs";
import { JsonLd } from "../components/seo/JsonLd";
import { createPageMetadata } from "../lib/seo";
import { marketplaces, siteConfig } from "../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Автоответы на отзывы, вопросы и сообщения покупателей",
  description:
    "MPReply собирает обращения с Wildberries, Ozon и Яндекс Маркета в одном окне, готовит ответы с помощью ИИ и автоматизирует отправку.",
  path: "/",
  localized: true,
});

const homeMarketplaceKeys = ["wildberries", "ozon", "yandex-market"] as const;
const homeMarketplaces = homeMarketplaceKeys.map((key) => marketplaces.find((marketplace) => marketplace.key === key)!).filter(Boolean);

const aiModels = [
  { name: "GPT-5.6", provider: "OpenAI", mark: "◎", description: "Глубокое понимание и генерация ответов" },
  { name: "Claude Sonnet 5", provider: "Anthropic", mark: "✺", description: "Анализ контекста и безопасные ответы" },
  { name: "Gemini 3.8", provider: "Google", mark: "✦", description: "Точность и фактические ответы" },
  { name: "DeepSeek V4.1 Flash", provider: "DeepSeek", mark: "◒", description: "Отлично работает с русским языком" },
] as const;

const resultFacts = [
  { icon: "◷", value: "до 70%", label: "меньше времени на ответы" },
  { icon: "▤", value: "3", label: "типа обращений в одном окне" },
  { icon: "ϟ", value: "4", label: "AI-модели для точных ответов" },
  { icon: "◎", value: "1", label: "рабочее окно вместо нескольких кабинетов" },
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
            <h1>Автоответы<br />на отзывы, вопросы<br />и сообщения<br /><span>покупателей</span></h1>
            <p className="homepage-hero-lead">Собирайте обращения с Wildberries, Ozon и Яндекс Маркета в одном окне. ИИ готовит ответы с учётом товара и стиля вашего бренда — автоматически или после проверки.</p>
            <div className="homepage-hero-actions">
              <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">Попробовать бесплатно <span aria-hidden="true">→</span></Link>
              <Link className="button button-secondary homepage-demo-button" href="/demo"><span aria-hidden="true">▶</span>Посмотреть демо</Link>
            </div>
            <div className="homepage-hero-benefits" role="group" aria-label="Условия старта"><span>✓ Быстрое подключение</span><span>✓ 14 дней бесплатно</span><span>✓ Без карты</span></div>
          </div>
          <div className="homepage-hero-art home-reference-hero-art">
            <Image alt="Интерфейс MPReply с общей очередью обращений и ответом с помощью ИИ" height={450} priority sizes="(max-width: 1100px) 100vw, 50vw" src="/images/mpreply-hero-ui.webp" width={600} />
          </div>
        </div>

        <div className="public-container homepage-approved-marketplaces home-reference-marketplaces" role="group" aria-labelledby="homepage-marketplaces-title">
          <div className="homepage-marketplaces-copy"><span>ПОДДЕРЖИВАЕМ ВЕДУЩИЕ МАРКЕТПЛЕЙСЫ</span><h2 id="homepage-marketplaces-title">Маркетплейсы</h2></div>
          <div className="homepage-marketplace-list">
            {homeMarketplaces.map((marketplace) => (
              <Link key={marketplace.key} className="homepage-marketplace-link" href={marketplace.path}>
                <span className={`homepage-marketplace-logo homepage-marketplace-logo-${marketplace.key}`} aria-hidden="true">{marketplace.mark}</span><strong>{marketplace.name}</strong>
              </Link>
            ))}
          </div>
          <div className="homepage-marketplace-facts" role="group" aria-label="Факты о продукте"><span><strong>3</strong><small>маркетплейса</small></span><span><strong>1</strong><small>единое окно</small></span><span><strong>-70%</strong><small>времени на ответы</small></span></div>
        </div>
      </section>

      <section className="public-section homepage-workspace-section home-reference-workspace" id="product">
        <div className="public-container homepage-feature-layout">
          <div className="homepage-section-heading-left">
            <p className="homepage-kicker">ВСЕ ОБРАЩЕНИЯ В ОДНОМ ОКНЕ</p>
            <h2>Отзывы, вопросы<br />и сообщения — в едином<br />пространстве</h2>
            <p>Переключайтесь между типами обращений, просматривайте контекст, используйте ИИ и отправляйте ответы в несколько кликов.</p>
            <Link className="button button-primary homepage-inline-cta" href="/demo">Посмотреть интерфейс&nbsp; →</Link>
          </div>
          <HomeWorkspaceTabs />
        </div>
      </section>

      <section className="public-section homepage-models-section home-reference-models">
        <div className="public-container homepage-models-layout">
          <div className="homepage-section-heading-left">
            <p className="homepage-kicker">СИЛА СОВРЕМЕННЫХ ИИ</p>
            <h2>Используем лучшие нейросети для точных и естественных ответов</h2>
            <p>Комбинируем возможности ведущих AI-моделей, чтобы учитывать контекст товара, тональность вашего бренда и особенности маркетплейсов.</p>
          </div>
          <div className="homepage-model-grid" role="group" aria-label="Поддерживаемые ИИ-модели">
            {aiModels.map((model, index) => (
              <article className={`homepage-model-card home-reference-model-card model-${index + 1}`} key={model.name}><span className="homepage-model-mark" aria-hidden="true">{model.mark}</span><strong>{model.name}</strong><small>{model.provider}</small><p>{model.description}</p></article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section homepage-approved-process home-reference-process" id="how-it-works">
        <div className="public-container">
          <div className="homepage-section-heading-left homepage-process-heading"><p className="homepage-kicker">ПРОСТОЙ И ПОНЯТНЫЙ ПРОЦЕСС</p><h2>Как это работает</h2><p>Подключите маркетплейсы и начните экономить время уже сегодня.</p></div>
          <ol className="homepage-horizontal-process">
            <li className="homepage-horizontal-step">
              <div className="homepage-horizontal-step-topline"><span className="homepage-process-number-circle">1</span><span className="homepage-process-connector" aria-hidden="true" /></div>
              <div className="homepage-process-card homepage-process-card-connect"><span className="homepage-process-card-icon" aria-hidden="true">↗</span><h3>Подключите<br />маркетплейсы</h3><p>Добавьте свои магазины Wildberries, Ozon и Яндекс Маркет в несколько кликов.</p><div className="homepage-process-marketplaces" aria-hidden="true"><b>WB</b><b>OZ</b><b>М</b></div></div>
            </li>
            <li className="homepage-horizontal-step">
              <div className="homepage-horizontal-step-topline"><span className="homepage-process-number-circle">2</span><span className="homepage-process-connector" aria-hidden="true" /></div>
              <h3>Получайте обращения</h3><p>Все отзывы, вопросы и сообщения собираются в единую очередь.</p><div className="homepage-process-card homepage-process-card-inbox" aria-hidden="true"><span><i>АК</i><b>Новый отзыв</b><small>2 мин назад</small></span><span><i>ИС</i><b>Новый вопрос</b><small>6 мин назад</small></span><span><i>МП</i><b>Новое сообщение</b><small>12 мин назад</small></span></div>
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
          <div className="homepage-section-heading-left homepage-results-copy"><p className="homepage-kicker">РЕАЛЬНЫЕ РЕЗУЛЬТАТЫ</p><h2>Меньше рутины.<br />Больше времени<br />на развитие бизнеса.</h2><p>Автоматизируйте обработку обращений и сосредоточьтесь на том, что действительно важно — на ваших товарах и клиентах.</p></div>
          <div className="homepage-result-grid">{resultFacts.map((fact) => (<article className="homepage-result-card" key={fact.label}><span aria-hidden="true">{fact.icon}</span><strong>{fact.value}</strong><p>{fact.label}</p></article>))}</div>
        </div>
      </section>

      <section className="public-section homepage-approved-final-cta home-reference-final">
        <div className="public-container homepage-final-cta-card">
          <div className="homepage-final-cta-copy"><p className="homepage-kicker">НАЧНИТЕ СЕГОДНЯ</p><h2>Автоматизируйте<br />коммуникацию с покупателями</h2><p>Подключите маркетплейсы и попробуйте все возможности сервиса бесплатно в течение 14 дней.</p><div className="homepage-final-cta-actions"><Link className="button button-primary" href="/auth/register?intent=connect-marketplace">Попробовать бесплатно&nbsp; →</Link><Link className="button button-secondary homepage-demo-button" href="/demo"><span aria-hidden="true">▶</span> Посмотреть демо</Link></div><div className="homepage-final-benefits" role="group" aria-label="Условия старта"><span>✓ Без карты</span><span>✓ 14 дней бесплатно</span><span>✓ Быстрое подключение</span></div></div>
          <div className="homepage-cta-art home-reference-cta-art" aria-hidden="true"><Image alt="" height={450} sizes="(max-width: 760px) 100vw, 38vw" src="/images/mpreply-cta-ui.webp" width={600} /></div>
        </div>
      </section>
    </HomeApprovedShell>
  );
}
