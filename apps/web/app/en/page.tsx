import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { HomeApprovedShell } from "../../components/public-site/HomeApprovedShell";
import { HomeWorkspaceTabs } from "../../components/public-site/HomeWorkspaceTabs";
import { JsonLd } from "../../components/seo/JsonLd";
import { createPageMetadata } from "../../lib/seo";
import { getSiteConfig, marketplacesEn } from "../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "AI replies for marketplace reviews, questions, and customer messages",
  description:
    "MPReply brings marketplace customer messages into one workspace, drafts replies with AI, and automates routine responses with review controls.",
  path: "/",
  locale: "en",
  localized: true,
});

const homeMarketplaceKeys = ["wildberries", "ozon", "yandex-market"] as const;
const homeMarketplaces = homeMarketplaceKeys.map((key) => marketplacesEn.find((marketplace) => marketplace.key === key)!).filter(Boolean);

const aiModels = [
  { name: "GPT-5.6", provider: "OpenAI", mark: "◎", description: "Strong reasoning for nuanced customer replies" },
  { name: "Claude Sonnet 5", provider: "Anthropic", mark: "✺", description: "Context-aware drafting for careful responses" },
  { name: "Gemini 3.8", provider: "Google", mark: "✦", description: "Useful for grounded, concise answers" },
  { name: "DeepSeek V4.1 Flash", provider: "DeepSeek", mark: "◒", description: "Fast drafting for routine reply workflows" },
] as const;

const resultFacts = [
  { icon: "◷", value: "Less", label: "manual reply work" },
  { icon: "▤", value: "3", label: "customer message types in one workspace" },
  { icon: "ϟ", value: "4", label: "AI models for reply drafting" },
  { icon: "◎", value: "1", label: "workspace instead of multiple seller panels" },
] as const;

export default function EnglishHomePage() {
  const siteConfig = getSiteConfig("en");
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "WebSite", name: siteConfig.name, url: `${siteConfig.origin}/en`, description: siteConfig.description, inLanguage: "en-US" },
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name: siteConfig.name, applicationCategory: "BusinessApplication", operatingSystem: "Web", description: siteConfig.description, url: siteConfig.origin },
  ];

  return (
    <HomeApprovedShell locale="en">
      <JsonLd data={jsonLd} />

      <section className="homepage-approved-hero home-reference-hero">
        <div className="home-reference-hero-shape home-reference-hero-shape-a" aria-hidden="true" />
        <div className="home-reference-hero-shape home-reference-hero-shape-b" aria-hidden="true" />
        <div className="public-container homepage-hero-grid">
          <div className="homepage-hero-copy">
            <p className="homepage-kicker homepage-pill-kicker">AI for marketplace seller teams</p>
            <h1>AI-assisted replies<br />for reviews, questions,<br />and customer<br /><span>messages</span></h1>
            <p className="homepage-hero-lead">Bring messages from Wildberries, Ozon, and Yandex Market into one workspace. AI drafts replies using product context and your preferred tone, with automation or review before sending.</p>
            <div className="homepage-hero-actions">
              <Link className="button button-primary" href="/en/auth/register?intent=connect-marketplace">Start free <span aria-hidden="true">→</span></Link>
              <Link className="button button-secondary homepage-demo-button" href="/en/demo"><span aria-hidden="true">▶</span>View demo</Link>
            </div>
            <div className="homepage-hero-benefits" role="group" aria-label="Getting started"><span>✓ Quick setup</span><span>✓ 14-day trial</span><span>✓ No card required</span></div>
          </div>
          <div className="homepage-hero-art home-reference-hero-art">
            <Image alt="MPReply workspace with a unified customer-message queue and AI-assisted reply" height={450} priority sizes="(max-width: 1100px) 100vw, 50vw" src="/images/mpreply-hero-ui.webp" width={600} />
          </div>
        </div>

        <div className="public-container homepage-approved-marketplaces home-reference-marketplaces" role="group" aria-labelledby="homepage-marketplaces-title">
          <div className="homepage-marketplaces-copy"><span>BUILT FOR LEADING MARKETPLACES</span><h2 id="homepage-marketplaces-title">Marketplaces</h2></div>
          <div className="homepage-marketplace-list">
            {homeMarketplaces.map((marketplace) => (
              <Link key={marketplace.key} className="homepage-marketplace-link" href={marketplace.path}>
                <span className={`homepage-marketplace-logo homepage-marketplace-logo-${marketplace.key}`} aria-hidden="true">{marketplace.mark}</span><strong>{marketplace.name}</strong>
              </Link>
            ))}
          </div>
          <div className="homepage-marketplace-facts" role="group" aria-label="Product overview"><span><strong>3</strong><small>marketplaces</small></span><span><strong>1</strong><small>shared workspace</small></span><span><strong>AI</strong><small>assisted reply drafting</small></span></div>
        </div>
      </section>

      <section className="public-section homepage-workspace-section home-reference-workspace" id="product">
        <div className="public-container homepage-feature-layout">
          <div className="homepage-section-heading-left">
            <p className="homepage-kicker">ONE WORKSPACE FOR CUSTOMER MESSAGES</p>
            <h2>Reviews, questions,<br />and customer messages<br />in one workspace</h2>
            <p>Move between message types, review the available context, use AI-assisted drafts, and send replies without jumping between marketplace panels.</p>
            <Link className="button button-primary homepage-inline-cta" href="/en/demo">Explore the workspace&nbsp; →</Link>
          </div>
          <HomeWorkspaceTabs />
        </div>
      </section>

      <section className="public-section homepage-models-section home-reference-models">
        <div className="public-container homepage-models-layout">
          <div className="homepage-section-heading-left">
            <p className="homepage-kicker">AI-ASSISTED REPLY WORKFLOWS</p>
            <h2>Choose the right AI model for clear, context-aware replies</h2>
            <p>Use supported AI models to draft replies around the available product context, your response style, and the customer message in front of your team.</p>
          </div>
          <div className="homepage-model-grid" role="group" aria-label="Supported AI models">
            {aiModels.map((model, index) => (
              <article className={`homepage-model-card home-reference-model-card model-${index + 1}`} key={model.name}><span className="homepage-model-mark" aria-hidden="true">{model.mark}</span><strong>{model.name}</strong><small>{model.provider}</small><p>{model.description}</p></article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section homepage-approved-process home-reference-process" id="how-it-works">
        <div className="public-container">
          <div className="homepage-section-heading-left homepage-process-heading"><p className="homepage-kicker">A CLEAR DAY-TO-DAY WORKFLOW</p><h2>How it works</h2><p>Connect the marketplaces you use and bring supported customer messages into one workflow.</p></div>
          <ol className="homepage-horizontal-process">
            <li className="homepage-horizontal-step">
              <div className="homepage-horizontal-step-topline"><span className="homepage-process-number-circle">1</span><span className="homepage-process-connector" aria-hidden="true" /></div>
              <div className="homepage-process-card homepage-process-card-connect"><span className="homepage-process-card-icon" aria-hidden="true">↗</span><h3>Connect your<br />marketplaces</h3><p>Add your Wildberries, Ozon, and Yandex Market accounts to the workspace.</p><div className="homepage-process-marketplaces" aria-hidden="true"><b>WB</b><b>OZ</b><b>YM</b></div></div>
            </li>
            <li className="homepage-horizontal-step">
              <div className="homepage-horizontal-step-topline"><span className="homepage-process-number-circle">2</span><span className="homepage-process-connector" aria-hidden="true" /></div>
              <h3>Collect customer messages</h3><p>Supported reviews, questions, and customer messages appear in one queue.</p><div className="homepage-process-card homepage-process-card-inbox" aria-hidden="true"><span><i>AK</i><b>New review</b><small>2 min ago</small></span><span><i>DS</i><b>New question</b><small>6 min ago</small></span><span><i>EM</i><b>New message</b><small>12 min ago</small></span></div>
            </li>
            <li className="homepage-horizontal-step">
              <div className="homepage-horizontal-step-topline"><span className="homepage-process-number-circle">3</span><span className="homepage-process-connector" aria-hidden="true" /></div>
              <h3>AI drafts the reply</h3><p>Use product context, message details, and your team rules.</p><div className="homepage-process-card homepage-process-card-ai" aria-hidden="true"><strong>✦ &nbsp; Draft ready!</strong><span /><span /><span /></div>
            </li>
            <li className="homepage-horizontal-step">
              <div className="homepage-horizontal-step-topline"><span className="homepage-process-number-circle">4</span></div>
              <div className="homepage-process-card homepage-process-card-send"><span className="homepage-process-card-icon" aria-hidden="true">➤</span><h3>Send with control</h3><p>Send automatically where your rules allow it, or review before sending.</p><div className="homepage-process-switches" aria-hidden="true"><span><b>✦ Automatic</b><i className="is-on" /></span><span><b>⌁ Needs review</b><i /></span><span><b>✓ Sent</b><i /></span></div></div>
            </li>
          </ol>
        </div>
      </section>

      <section className="public-section homepage-results-section home-reference-results">
        <div className="public-container homepage-results-layout">
          <div className="homepage-section-heading-left homepage-results-copy"><p className="homepage-kicker">LESS REPETITIVE WORK</p><h2>Spend less time<br />switching tools and<br />rewriting routine replies.</h2><p>Keep the team focused on customer conversations that need judgment while routine work follows a consistent process.</p></div>
          <div className="homepage-result-grid">{resultFacts.map((fact) => (<article className="homepage-result-card" key={fact.label}><span aria-hidden="true">{fact.icon}</span><strong>{fact.value}</strong><p>{fact.label}</p></article>))}</div>
        </div>
      </section>

      <section className="public-section homepage-approved-final-cta home-reference-final">
        <div className="public-container homepage-final-cta-card">
          <div className="homepage-final-cta-copy"><p className="homepage-kicker">GET STARTED</p><h2>Bring marketplace<br />customer communication<br />into one workflow</h2><p>Connect a marketplace account and try the MPReply workflow for 14 days.</p><div className="homepage-final-cta-actions"><Link className="button button-primary" href="/en/auth/register?intent=connect-marketplace">Start free&nbsp; →</Link><Link className="button button-secondary homepage-demo-button" href="/en/demo"><span aria-hidden="true">▶</span> View demo</Link></div><div className="homepage-final-benefits" role="group" aria-label="Getting started"><span>✓ No card required</span><span>✓ 14-day trial</span><span>✓ Quick setup</span></div></div>
          <div className="homepage-cta-art home-reference-cta-art" aria-hidden="true"><Image alt="" height={450} sizes="(max-width: 760px) 100vw, 38vw" src="/images/mpreply-cta-ui.webp" width={600} /></div>
        </div>
      </section>
    </HomeApprovedShell>
  );
}
