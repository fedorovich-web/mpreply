import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { HomeWorkspaceTabs } from "../../components/public-site/HomeWorkspaceTabs";
import { HomeLineIcon } from "../../components/public-site/HomeLineIcon";
import { PublicIcon } from "../../components/public-site/PublicIcon";
import { JsonLd } from "../../components/seo/JsonLd";
import { createPageMetadata } from "../../lib/seo";
import { getMarketplaceConfig, getSiteConfig } from "../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "AI replies for marketplace reviews, questions, and customer messages",
  description:
    "MPReply brings marketplace customer messages into one workspace, drafts replies with AI, and automates routine responses with review controls.",
  path: "/",
  locale: "en",
  localized: true,
});

const homeMarketplaceKeys = ["wildberries", "ozon", "yandex-market", "avito"] as const;
const homeMarketplaces = homeMarketplaceKeys.map((key) => getMarketplaceConfig(key, "en"));
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
  { icon: "/images/icons/final/01-wildberries.avif", value: "4", label: "marketplace surfaces in MPReply" },
  { icon: "/images/icons/final/05-chat.avif", value: "1", label: "shared customer-message queue" },
  { icon: "/images/icons/final/17-calendar.avif", value: "14", label: "days in the approved trial" },
  { icon: "/images/icons/final/12-quality-shield.avif", value: "2", label: "paths: automation or review" },
] as const;

export default function EnglishHomePage() {
  const siteConfig = getSiteConfig("en");
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "WebSite", name: siteConfig.name, url: `${siteConfig.origin}/en`, description: siteConfig.description, inLanguage: "en-US" },
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name: siteConfig.name, applicationCategory: "BusinessApplication", operatingSystem: "Web", description: siteConfig.description, url: siteConfig.origin },
  ];

  return (
    <PublicShell home locale="en">
      <JsonLd data={jsonLd} />

      <section className="homepage-approved-hero home-reference-hero">
        <div className="home-reference-hero-shape home-reference-hero-shape-a" aria-hidden="true" />
        <div className="home-reference-hero-shape home-reference-hero-shape-b" aria-hidden="true" />
        <div className="public-container homepage-hero-grid">
          <div className="homepage-hero-copy">

            <h1>AI-assisted replies<br />for reviews, questions,<br />and customer<br /><span>messages</span></h1>
            <p className="homepage-hero-lead">Bring supported customer messages from Wildberries, Ozon, Yandex Market, and Avito into one queue. AI drafts replies from available context, with rules for automation and review before sending.</p>
            <div className="homepage-hero-actions">
              <Link className="button button-primary" href="/en/auth/register?intent=connect-marketplace">Start free <span aria-hidden="true">→</span></Link>
              <Link className="button button-secondary homepage-demo-button" href="/en/demo"><PublicIcon name="play" />View demo</Link>
            </div>
            <div className="homepage-hero-benefits" role="group" aria-label="Getting started"><span>✓ Shared queue</span><span>✓ 14-day trial</span><span>✓ Review before sending</span></div>
          </div>
          <div className="homepage-hero-art home-reference-hero-art">
            <Image alt="MPReply workspace with a unified customer-message queue and AI-assisted reply" height={1062} priority sizes="(max-width: 1100px) 100vw, 50vw" src="/images/approved/01-home-hero.avif" width={1481} unoptimized />
          </div>
        </div>
      </section>

      <div className="home-reference-marketplace-band">
        <div className="public-container homepage-approved-marketplaces home-reference-marketplaces" role="group" aria-labelledby="homepage-marketplaces-title">
          <div className="homepage-marketplaces-copy"><span>SUPPORTED MARKETPLACE SURFACES</span><h2 id="homepage-marketplaces-title">Marketplaces</h2></div>
          <div className="homepage-marketplace-list">
            {homeMarketplaces.map((marketplace) => (
              <Link key={marketplace.key} className="homepage-marketplace-link" href={marketplace.path} aria-label={marketplace.name}>
                <span className={`homepage-marketplace-logo homepage-marketplace-logo-${marketplace.key}`} aria-hidden="true"><Image src={homeMarketplaceLogos[marketplace.key]} alt="" width={256} height={256} unoptimized /></span>
              </Link>
            ))}
          </div>
          <div className="homepage-marketplace-facts" role="group" aria-label="Product overview"><span><strong>4</strong><small>marketplace surfaces</small></span><span><strong>1</strong><small>shared queue</small></span><span><strong>14</strong><small>days in the trial</small></span></div>
        </div>
      </div>

      <section className="public-section homepage-workspace-section home-reference-workspace" id="product">
        <div className="public-container homepage-feature-layout">
          <div className="homepage-section-heading-left">

            <h2>Reviews, questions,<br />and customer messages<br />in one workspace</h2>
            <p>Move between message types, review the available context, use AI-assisted drafts, and send replies without jumping between marketplace panels.</p>
            <Link className="button button-primary homepage-inline-cta" href="/en/demo">Explore the workspace&nbsp; →</Link>
          </div>
          <HomeWorkspaceTabs locale="en" />
        </div>
      </section>

      <section className="public-section homepage-models-section home-reference-models">
        <div className="public-container homepage-models-layout">
          <div className="homepage-section-heading-left">

            <h2>4 AI models for different tasks</h2>
            <p>Each customer message follows a reply scenario suited to the request.</p>
          </div>
          <div className="homepage-model-grid" role="group" aria-label="Four AI models">
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
          <div className="homepage-section-heading-left homepage-process-heading"><h2>How it works</h2><p>Connect the marketplaces you use and bring supported customer messages into one workflow.</p></div>
          <ol className="homepage-horizontal-process">
            <li className="homepage-horizontal-step">
              <div className="homepage-process-card homepage-process-card-connect"><span className="homepage-process-card-icon"><PublicIcon name="link" /></span><h3>Connect your<br />marketplaces</h3><p>Add a supported marketplace connection to the MPReply workspace.</p><div className="homepage-process-marketplaces" role="group" aria-label="Wildberries, Ozon, Yandex Market, Avito">{homeMarketplaceKeys.map((key) => <span key={key}><Image src={key === "avito" ? "/images/brands/avito-sign-logo.svg" : homeMarketplaceLogos[key]} alt={getMarketplaceConfig(key, "en").name} width={128} height={128} unoptimized /></span>)}</div></div>
            </li>
            <li className="homepage-horizontal-step">
              <h3>Collect customer messages</h3><p>Supported reviews, questions, and customer messages appear in one queue.</p><div className="homepage-process-card homepage-process-card-inbox" aria-hidden="true"><span><i><HomeLineIcon name="star" /></i><b>Review</b></span><span><i><HomeLineIcon name="question" /></i><b>Question</b></span><span><i><HomeLineIcon name="message" /></i><b>Message</b></span></div>
            </li>
            <li className="homepage-horizontal-step">
              <h3>AI drafts the reply</h3><p>Use product context, message details, and your team rules.</p><div className="homepage-process-card homepage-process-card-ai" aria-hidden="true"><strong>✦ &nbsp; Draft ready!</strong><span /><span /><span /></div>
            </li>
            <li className="homepage-horizontal-step">
              <div className="homepage-process-card homepage-process-card-send"><span className="homepage-process-card-icon"><PublicIcon name="send" /></span><h3>Send with control</h3><p>Send automatically where your rules allow it, or review before sending.</p><div className="homepage-process-switches" aria-hidden="true"><span><b>✦ Automatic</b><i className="is-on" /></span><span><b>⌁ Needs review</b><i /></span><span><b>✓ Sent</b><i /></span></div></div>
            </li>
          </ol>
        </div>
      </section>

      <section className="public-section homepage-results-section home-reference-results">
        <div className="public-container homepage-results-layout">
          <div className="homepage-section-heading-left homepage-results-copy"><h2>One queue.<br />Context nearby.<br />Control before sending.</h2><p>MPReply combines supported customer messages, AI-assisted drafts, automation rules, and human review in one workflow.</p></div>
          <div className="homepage-result-grid">{resultFacts.map((fact) => (<div className="homepage-result-card" key={fact.label}><span><Image src={fact.icon} alt="" width={128} height={128} unoptimized /></span><strong>{fact.value}</strong><p>{fact.label}</p></div>))}</div>
        </div>
      </section>

      <section className="public-section homepage-approved-final-cta home-reference-final">
        <div className="public-container homepage-final-cta-card">
          <div className="homepage-final-cta-copy"><h2>Bring marketplace<br />customer communication<br />into one workflow</h2><p>Try MPReply for 14 days with 350 AI replies included in the trial.</p><div className="homepage-final-cta-actions"><Link className="button button-primary" href="/en/auth/register?intent=connect-marketplace">Start free&nbsp; →</Link><Link className="button button-secondary homepage-demo-button" href="/en/demo"><PublicIcon name="play" />View demo</Link></div><div className="homepage-final-benefits" role="group" aria-label="Getting started"><span>✓ 14-day trial</span><span>✓ Shared queue</span><span>✓ Review before sending</span></div></div>
          <div className="homepage-cta-art home-reference-cta-art" aria-hidden="true"><Image alt="" height={1086} sizes="(max-width: 760px) 100vw, 38vw" src="/images/approved/04-marketplaces-cta.avif" width={1448} unoptimized /></div>
        </div>
      </section>
    </PublicShell>
  );
}
