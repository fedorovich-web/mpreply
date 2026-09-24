import Image from "next/image";
import Link from "next/link";

import { getMarketplaceDetailContent } from "../../lib/marketplace-detail-content";
import { getMarketplaceDetailContentEn } from "../../lib/marketplace-detail-content-en";
import type { Locale } from "../../lib/i18n";
import { getSiteConfig, type MarketplaceConfig, type MarketplaceKey } from "../../lib/site-config";
import { PublicBrandMark } from "./PublicBrandMark";
import { PublicIcon } from "./PublicIcon";
import { PublicShell } from "./PublicShell";

type MarketplaceLandingProps = {
  marketplace: MarketplaceConfig;
  locale?: Locale;
};

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

const sampleVisualIcons = {
  review: "star",
  order: "archive",
  listing: "message",
} as const;

function MultilineText({ value }: { value: string }) {
  const lines = value.split("\n");

  return (
    <>
      {lines.map((line, index) => (
        <span key={`${line}-${index}`}>
          {index > 0 ? <br /> : null}
          {line}
        </span>
      ))}
    </>
  );
}

export function MarketplaceLanding({ marketplace, locale = "ru" }: MarketplaceLandingProps) {
  const platformLabel = marketplace.name === "Wildberries" ? "WILDBERRIES" : marketplace.name.toUpperCase();
  const logo = marketplaceLogos[marketplace.key];
  const detailContent = locale === "en"
    ? getMarketplaceDetailContentEn(marketplace.key)
    : getMarketplaceDetailContent(marketplace.key);
  const siteConfig = getSiteConfig(locale);
  const copy = locale === "en"
    ? {
        integrations: "Integrations",
        breadcrumbs: "Breadcrumbs",
        connect: "Connect",
        viewDemo: "View demo",
        startTerms: "Getting started",
        imageLabel: "customer-message workflow in MPReply",
        ago: "12 min ago",
        ai: "AI",
        useReply: "Use reply",
        integrationFeatures: "Integration features",
        howItWorks: "How it works",
        teamBenefits: "What the team gets",
        beforeConnecting: "Before connecting",
        faq: "Frequently asked questions",
        allIntegrations: "All MPReply integrations",
        comparePlans: "Compare plans",
      }
    : {
        integrations: "Интеграции",
        breadcrumbs: "Хлебные крошки",
        connect: "Подключить",
        viewDemo: "Посмотреть демо",
        startTerms: "Условия старта",
        imageLabel: "Обработка обращения в MPReply",
        ago: "12 мин назад",
        ai: "ИИ",
        useReply: "Использовать ответ",
        integrationFeatures: "Возможности интеграции",
        howItWorks: "Как это работает",
        teamBenefits: "Что получает команда",
        beforeConnecting: "Перед подключением",
        faq: "Частые вопросы",
        allIntegrations: "Все интеграции MPReply",
        comparePlans: "Сравнить тарифы",
      };
  const marketplacesPath = locale === "en" ? "/en/marketplaces" : "/marketplaces";
  const demoPath = locale === "en" ? "/en/demo" : "/demo";
  const registerPath = locale === "en"
    ? "/en/auth/register?intent=connect-marketplace"
    : "/auth/register?intent=connect-marketplace";
  const pricingPath = locale === "en" ? "/en/pricing" : "/pricing";
  const sampleVisual = detailContent.sampleVisual;
  const sampleVisualIcon = sampleVisual === "product" ? null : sampleVisualIcons[sampleVisual];
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: copy.integrations,
        item: `${siteConfig.origin}${marketplacesPath}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: marketplace.name,
        item: `${siteConfig.origin}${marketplace.path}`,
      },
    ],
  };

  return (
    <PublicShell locale={locale}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="mockup-page">
        <section className="marketplace-detail-mockup-hero">
          <div className="public-container marketplace-detail-mockup-grid">
            <div className="marketplace-detail-mockup-copy">
              <nav className="marketplace-detail-breadcrumbs" aria-label={copy.breadcrumbs}>
                <Link href={marketplacesPath}>{copy.integrations}</Link>
                <span aria-hidden="true">/</span>
                <span aria-current="page">{marketplace.name}</span>
              </nav>
              <p className="mockup-eyebrow">{platformLabel} + MPReply</p>
              <h1>{detailContent.heroTitle}</h1>
              <p>{detailContent.heroDescription}</p>
              <div className="mockup-actions">
                <Link className="button button-primary" href={registerPath}>
                  {copy.connect} {marketplace.name} <span aria-hidden="true">→</span>
                </Link>
                <Link className="button button-secondary" href={demoPath}>
                  <PublicIcon name="play" className="public-inline-icon" /> {copy.viewDemo}
                </Link>
              </div>
              <div className="mockup-trust-row" aria-label={copy.startTerms}>
                {detailContent.trustItems.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>

            <div
              className="marketplace-detail-render"
              role="img"
              aria-label={`${marketplace.name} ${copy.imageLabel}`}
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
                  <strong>{detailContent.sampleType} · {copy.ago}</strong>
                  {detailContent.sampleMessage}
                </div>
                <div className="detail-product-row">
                  <span className={`detail-product-thumb is-${sampleVisual}`} aria-hidden="true">
                    {sampleVisualIcon ? <PublicIcon name={sampleVisualIcon} /> : null}
                  </span>
                  <span>
                    <MultilineText value={detailContent.sampleContext} />
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
                    {detailContent.sidebarItems.map((item) => (
                      <span
                        className={item.active ? "detail-sidebar-item is-active" : "detail-sidebar-item"}
                        key={item.label}
                      >
                        <PublicIcon name={item.icon} />
                        {item.label}
                        {item.count !== undefined ? <b>{item.count}</b> : null}
                      </span>
                    ))}
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
                      <strong>{detailContent.sampleType}</strong>
                      <span>{copy.ago}</span>
                    </div>
                    <h3>{detailContent.sampleMessage}</h3>
                    <p>{detailContent.sampleContext.replace("\n", " · ")}</p>
                  </div>
                </div>
              </div>

              <div className="detail-ai-card">
                <strong>
                  <PublicIcon name="sparkles" className="public-inline-icon" /> {copy.ai}
                </strong>
                <p>{detailContent.sampleReply}</p>
                <span>{copy.useReply}</span>
              </div>

              <div className="detail-hero-note" aria-hidden="true">
                <MultilineText value={detailContent.heroNote} />
                <span>↙</span>
              </div>
              <div className="mockup-mascot detail-render-mascot" aria-hidden="true" />
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">{copy.integrationFeatures}</p>
              <h2>{detailContent.toolsHeading}</h2>
              <p>{detailContent.toolsDescription}</p>
            </div>
            <div className="marketplace-detail-tools">
              {detailContent.tools.map((tool) => (
                <article className="detail-tool-card" key={tool.title}>
                  <span className={`mockup-icon-chip ${tool.tone === "blue" ? "" : tool.tone}`} aria-hidden="true">
                    <PublicIcon name={tool.icon} />
                  </span>
                  <h3>{tool.title}</h3>
                  <p>{tool.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">{copy.howItWorks}</p>
              <h2>{detailContent.stepsHeading}</h2>
              <p>{detailContent.stepsDescription}</p>
            </div>
            <div className="marketplace-detail-steps">
              {detailContent.steps.map((step, index) => (
                <article className="detail-step-card" key={step.title}>
                  <span className="detail-step-number">{index + 1}</span>
                  <span className={`mockup-icon-chip ${index === 1 ? "purple" : ""}`} aria-hidden="true">
                    <PublicIcon name={step.icon} />
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">{copy.teamBenefits}</p>
              <h2>{detailContent.benefitsHeading}</h2>
              <p>{detailContent.benefitsDescription}</p>
            </div>
            <div className="marketplace-detail-benefits">
              {detailContent.benefits.map((benefit) => (
                <article className="detail-benefit-card" key={benefit.title}>
                  <span
                    className={`mockup-icon-chip ${benefit.tone === "blue" ? "" : benefit.tone}`}
                    aria-hidden="true"
                  >
                    <PublicIcon name={benefit.icon} />
                  </span>
                  <h3>{benefit.title}</h3>
                  <p>{benefit.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container detail-faq-layout">
            <div>
              <p className="mockup-eyebrow">{copy.beforeConnecting}</p>
              <h2>{copy.faq}</h2>
              <p>{detailContent.faqIntro}</p>
            </div>
            <div className="marketplace-detail-faq">
              {detailContent.faq.map((item) => (
                <details key={item.question}>
                  <summary className="detail-faq-summary">
                    <span className="detail-faq-icon" aria-hidden="true">
                      <PublicIcon name={item.icon} />
                    </span>
                    <span>{item.question}</span>
                    <span className="detail-faq-chevron" aria-hidden="true">⌄</span>
                  </summary>
                  <p>{item.answer}</p>
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
                <h2>{detailContent.finalTitle}</h2>
                <p>{detailContent.finalDescription}</p>
              </div>
              <div className="mockup-cta-strip-side">
                <Link className="button button-primary" href={registerPath}>
                  {copy.connect} {marketplace.name} <span aria-hidden="true">→</span>
                </Link>
                <div className="marketplace-detail-next-links">
                  <Link href={marketplacesPath}>{copy.allIntegrations}</Link>
                  <Link href={pricingPath}>{copy.comparePlans}</Link>
                </div>
                <div className="mockup-trust-row" aria-label={copy.startTerms}>
                  {detailContent.trustItems.map((item) => (
                    <span key={`final-${item}`}>{item}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
