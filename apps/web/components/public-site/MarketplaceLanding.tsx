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
    src: "/images/icons/final/01-wildberries.avif",
    compactSrc: "/images/icons/final/01-wildberries.avif",
    width: 256,
    height: 256,
  },
  ozon: {
    src: "/images/icons/final/02-ozon.avif",
    compactSrc: "/images/icons/final/02-ozon.avif",
    width: 256,
    height: 256,
  },
  "yandex-market": {
    src: "/images/icons/final/03-yandex-market.avif",
    compactSrc: "/images/icons/final/03-yandex-market.avif",
    width: 256,
    height: 256,
  },
  avito: {
    src: "/images/icons/final/04-avito.avif",
    compactSrc: "/images/brands/avito-sign-logo.svg",
    width: 256,
    height: 256,
  },
};

const approvedHeroImages: Record<MarketplaceKey, { src: string; width: number; height: number }> = {
  wildberries: { src: "/images/approved/04-wildberries-hero-corrected.avif", width: 1736, height: 906 },
  ozon: { src: "/images/approved/hero-ozon.avif", width: 1000, height: 563 },
  "yandex-market": { src: "/images/approved/hero-yandex-market.avif", width: 1000, height: 563 },
  avito: { src: "/images/approved/hero-avito.avif", width: 1000, height: 563 },
};

const sampleVisualIcons = {
  product: "archive",
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
  const logo = marketplaceLogos[marketplace.key];
  const approvedHero = approvedHeroImages[marketplace.key];
  const detailContent = locale === "en"
    ? getMarketplaceDetailContentEn(marketplace.key)
    : getMarketplaceDetailContent(marketplace.key);
  const siteConfig = getSiteConfig(locale);
  const copy = locale === "en"
    ? {
        integrations: "Integrations",
        connect: "Connect",
        viewDemo: "View demo",
        startTerms: "Getting started",
        imageLabel: "customer-message workflow in MPReply",
        ago: "12 min ago",
        ai: "AI",
        useReply: "Use reply",
        faq: "Frequently asked questions",
      }
    : {
        integrations: "Интеграции",
        connect: "Подключить",
        viewDemo: "Посмотреть демо",
        startTerms: "Условия старта",
        imageLabel: "Обработка обращения в MPReply",
        ago: "12 мин назад",
        ai: "ИИ",
        useReply: "Использовать ответ",
        faq: "Частые вопросы",
      };
  const marketplacesPath = locale === "en" ? "/en/marketplaces" : "/marketplaces";
  const demoPath = locale === "en" ? "/en/demo" : "/demo";
  const registerPath = locale === "en"
    ? "/en/auth/register?intent=connect-marketplace"
    : "/auth/register?intent=connect-marketplace";
  const sampleVisual = detailContent.sampleVisual;
  const useApprovedProductCrop = marketplace.key === "wildberries" && sampleVisual === "product";
  const sampleVisualIcon = useApprovedProductCrop ? null : sampleVisualIcons[sampleVisual];
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
      <div className={`mockup-page marketplace-detail-page is-${marketplace.key}`}>
        <section className="marketplace-detail-mockup-hero">
          <div className="public-container marketplace-detail-mockup-grid">
            <div className="marketplace-detail-mockup-copy">

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
              <div className="mockup-trust-row" role="group" aria-label={copy.startTerms}>
                {detailContent.trustItems.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>

            {locale === "ru" ? (
              <div className="marketplace-detail-render supplied-hero-scene">
                <Image
                  alt={`Обращение ${marketplace.name} и подготовленный ИИ-черновик в MPReply`}
                  className="supplied-hero-image"
                  src={approvedHero.src}
                  width={approvedHero.width}
                  height={approvedHero.height}
                  sizes="(max-width: 1100px) 100vw, 50vw"
                  priority
                  unoptimized
                />
              </div>
            ) : (
              <div
                className="marketplace-detail-render"
                role="group"
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
                    <span
                      className={`detail-product-thumb is-${sampleVisual} is-${marketplace.key}`}
                      aria-hidden="true"
                    >
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
                      <h2>{detailContent.sampleMessage}</h2>
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
            )}
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="render-section-head">

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

              <h2>{detailContent.stepsHeading}</h2>
              <p>{detailContent.stepsDescription}</p>
            </div>
            <div className="marketplace-detail-steps">
              {detailContent.steps.map((step, index) => (
                <article className="detail-step-card" key={step.title}>
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
                <div className="mockup-trust-row" role="group" aria-label={copy.startTerms}>
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
