import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import homeHero from "../public/images/approved/01-home-hero.avif";
import homeCta from "../public/images/approved/04-marketplaces-cta.avif";

import { PublicShell } from "../components/public-site/PublicShell";
import { HomeLineIcon } from "../components/public-site/HomeLineIcon";
import { PublicIcon } from "../components/public-site/PublicIcon";
import { HomeWorkspaceTabs } from "../components/public-site/HomeWorkspaceTabs";
import { JsonLd } from "../components/seo/JsonLd";
import { createPageMetadata } from "../lib/seo";
import { getMarketplaceConfig, siteConfig } from "../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "ИИ-ответы для обращений покупателей на маркетплейсах",
  description:
    "MPReply собирает поддерживаемые обращения Wildberries, Ozon, Яндекс Маркета и Авито в одной очереди, готовит ИИ-черновики с контекстом и сохраняет контроль перед отправкой.",
  path: "/",
  localized: true,
});

const homeMarketplaceKeys = ["wildberries", "ozon", "yandex-market", "avito"] as const;
const homeMarketplaces = homeMarketplaceKeys.map((key) => getMarketplaceConfig(key));
const homeMarketplaceLogos = {
  wildberries: "/images/icons/final/01-wildberries.avif",
  ozon: "/images/icons/final/02-ozon.avif",
  "yandex-market": "/images/icons/final/03-yandex-market.avif",
  avito: "/images/icons/final/04-avito.avif",
} as const;

const aiModels = [
  { name: "GPT 6", provider: "OpenAI", icon: "/images/brands/chatgpt-sign-logo.svg" },
  { name: "Claude Sonnet 5.5", provider: "Anthropic", icon: "/images/brands/claude-icon-logo.svg" },
  { name: "Gemini 3.8", provider: "Google", icon: "/images/brands/gemini.svg" },
  { name: "DeepSeek V4.1 Flash", provider: "DeepSeek", icon: "/images/brands/deepseek-sign-logo.svg" },
] as const;

const resultFacts = [
  { icon: "/images/icons/final/16-history-clock.avif", value: "350", label: "ИИ-ответов в пробном периоде" },
  { icon: "/images/icons/final/05-chat.avif", value: "3", label: "типа обращений в одном окне" },
  { icon: "/images/icons/final/34-ai-assistant.avif", value: "4", label: "нейросети для разных сценариев" },
  { icon: "/images/icons/final/19-team-users.avif", value: "1", label: "рабочее окно вместо нескольких кабинетов" },
] as const;

export default function HomePage() {
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "WebSite", name: siteConfig.name, url: siteConfig.origin, description: siteConfig.description, inLanguage: "ru-RU" },
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name: siteConfig.name, applicationCategory: "BusinessApplication", operatingSystem: "Web", description: siteConfig.description, url: siteConfig.origin },
  ];

  return (
    <PublicShell home>
      <JsonLd data={jsonLd} />

      <section className="homepage-approved-hero home-reference-hero">
        <div className="public-container homepage-hero-grid">
          <div className="homepage-hero-copy">

            <h1>Автоответы<br />на отзывы, вопросы<br />и сообщения<br /><span>покупателей</span></h1>
            <p className="homepage-hero-lead">Собирайте обращения с Wildberries, Ozon, Яндекс Маркета и Авито в одном окне. ИИ готовит ответы с учётом товара и стиля вашего бренда — автоматически или после проверки.</p>
            <div className="homepage-hero-actions">
              <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">Попробовать бесплатно <span aria-hidden="true">→</span></Link>
              <Link className="button button-secondary homepage-demo-button" href="/demo"><PublicIcon name="play" />Посмотреть демо</Link>
            </div>
            <div className="homepage-hero-benefits" role="group" aria-label="Условия старта"><span>✓ Быстрое подключение</span><span>✓ 14 дней бесплатно</span><span>✓ Без карты</span></div>
          </div>
          <div className="homepage-hero-art home-reference-hero-art">
            <Image alt="Интерфейс MPReply с общей очередью обращений и ответом с помощью ИИ" height={1062} priority sizes="(max-width: 1100px) 100vw, 50vw" src={homeHero} width={1481} quality={85} />
          </div>
        </div>
      </section>

      <div className="home-reference-marketplace-band">
        <div className="public-container homepage-approved-marketplaces home-reference-marketplaces" role="group" aria-labelledby="homepage-marketplaces-title">
          <div className="homepage-marketplaces-copy"><span id="homepage-marketplaces-title">ПОДДЕРЖИВАЕМЫЕ ВЕДУЩИЕ МАРКЕТПЛЕЙСЫ</span></div>
          <div className="homepage-marketplace-list">
            {homeMarketplaces.map((marketplace) => (
              <Link key={marketplace.key} className="homepage-marketplace-link" href={marketplace.path} aria-label={marketplace.name}>
                <span className={`homepage-marketplace-logo homepage-marketplace-logo-${marketplace.key}`} aria-hidden="true"><Image src={homeMarketplaceLogos[marketplace.key]} alt="" width={256} height={256} quality={85} sizes="112px" /></span>
              </Link>
            ))}
          </div>
          <div className="homepage-marketplace-facts" role="group" aria-label="Факты о продукте"><span><strong>4</strong><small>маркетплейса</small></span><span><strong>1</strong><small>единое окно</small></span><span><strong>350</strong><small>пробных ИИ-ответов</small></span></div>
        </div>
      </div>

      <section className="public-section homepage-workspace-section home-reference-workspace" id="product">
        <div className="public-container homepage-feature-layout">
          <div className="homepage-section-heading-left">

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

            <h2>Используем лучшие нейросети для точных и естественных ответов</h2>
            <p>Четыре нейросети для разных типов обращений покупателей.</p>
          </div>
          <div className="homepage-model-grid" role="group" aria-label="Четыре нейросети">
            {aiModels.map((model) => (
              <div className="homepage-model-card" key={model.name}>
                <span className="homepage-model-mark" aria-hidden="true"><Image src={model.icon} alt="" width={44} height={44} unoptimized /></span>
                <small>{model.provider}</small>
                <strong>{model.name}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section homepage-approved-process home-reference-process" id="how-it-works">
        <div className="public-container">
          <div className="homepage-section-heading-left homepage-process-heading"><h2>Как это работает</h2><p>Подключите площадки, настройте правила и проверяйте ответы там, где это нужно.</p></div>
          <div className="homepage-process-visual">
          <ol className="homepage-horizontal-process">
            <li className="homepage-horizontal-step">
              <div className="homepage-process-card homepage-process-card-connect"><span className="homepage-process-card-icon"><PublicIcon name="link" /></span><h3>Подключите<br />маркетплейсы</h3><p>Добавьте свои кабинеты Wildberries, Ozon, Яндекс Маркета и Авито в рабочем пространстве.</p><div className="homepage-process-marketplaces" role="group" aria-label="Wildberries, Ozon, Яндекс Маркет, Авито">{homeMarketplaceKeys.map((key) => <span key={key}><Image src={key === "avito" ? "/images/brands/avito-sign-logo.svg" : homeMarketplaceLogos[key]} alt={getMarketplaceConfig(key).name} width={64} height={64} quality={85} sizes="64px" /></span>)}</div></div>
            </li>
            <li className="homepage-horizontal-step">
              <h3>Получайте обращения</h3><p>Все отзывы, вопросы и сообщения собираются в единую очередь.</p><div className="homepage-process-card homepage-process-card-inbox" aria-hidden="true"><span><i><HomeLineIcon name="star" /></i><b>Отзыв</b></span><span><i><HomeLineIcon name="question" /></i><b>Вопрос</b></span><span><i><HomeLineIcon name="message" /></i><b>Сообщение</b></span></div>
            </li>
            <li className="homepage-horizontal-step">
              <h3>ИИ готовит ответы</h3><p>С учётом товара, контекста и ваших правил.</p><div className="homepage-process-card homepage-process-card-ai" aria-hidden="true"><strong><HomeLineIcon name="sparkle" /> Ответ готов!</strong><span /><span /><span /></div>
            </li>
            <li className="homepage-horizontal-step">
              <div className="homepage-process-card homepage-process-card-send"><span className="homepage-process-card-icon"><PublicIcon name="send" /></span><h3>Отправляйте</h3><p>Автоматически или после проверки сотрудником.</p><div className="homepage-process-switches" aria-hidden="true"><span><b>✦ Автоотправка</b><i className="is-on" /></span><span><b>⌁ На проверке</b><i /></span><span><b>✓ Отправлено</b><i /></span></div></div>
            </li>
          </ol>
          </div>
        </div>
      </section>

      <section className="public-section homepage-results-section home-reference-results">
        <div className="public-container homepage-results-layout">
          <div className="homepage-section-heading-left homepage-results-copy"><h2>Меньше рутины.<br />Больше времени<br />на развитие бизнеса.</h2><p>Автоматизируйте обработку обращений и сосредоточьтесь на том, что действительно важно — на ваших товарах и клиентах.</p></div>
          <div className="homepage-result-grid">{resultFacts.map((fact) => (<div className="homepage-result-card" key={fact.label}><span><Image src={fact.icon} alt="" width={192} height={192} quality={85} sizes="72px" /></span><strong>{fact.value}</strong><p>{fact.label}</p></div>))}</div>
        </div>
      </section>

      <section className="public-section homepage-approved-final-cta home-reference-final">
        <div className="public-container homepage-final-cta-card">
          <div className="homepage-final-cta-copy"><h2>Автоматизируйте<br />коммуникацию с покупателями</h2><p>Подключите маркетплейс и попробуйте MPReply в течение 14 дней: в пробный период включено 350 ИИ-ответов.</p><div className="homepage-final-cta-actions"><Link className="button button-primary" href="/auth/register?intent=connect-marketplace">Попробовать бесплатно&nbsp; →</Link><Link className="button button-secondary homepage-demo-button" href="/demo"><PublicIcon name="play" />Посмотреть демо</Link></div><div className="homepage-final-benefits" role="group" aria-label="Условия старта"><span>✓ Без карты</span><span>✓ 14 дней бесплатно</span><span>✓ Быстрое подключение</span></div></div>
          <div className="homepage-cta-art home-reference-cta-art" aria-hidden="true"><Image alt="" height={1086} sizes="(max-width: 760px) 100vw, 38vw" src={homeCta} width={1448} quality={85} /></div>
        </div>
      </section>
    </PublicShell>
  );
}
