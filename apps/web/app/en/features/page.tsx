import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PublicBrandMark } from "../../../components/public-site/PublicBrandMark";
import { PublicIcon, type PublicIconName } from "../../../components/public-site/PublicIcon";
import { PublicShell } from "../../../components/public-site/PublicShell";
import { createPageMetadata } from "../../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "MPReply features — AI-assisted replies, automation, and review workflows",
  description:
    "Explore MPReply features for marketplace seller teams: one customer-message queue, AI-assisted drafts, rule-based automation, review before sending, assignments, filters, and analytics.",
  path: "/features",
  locale: "en",
  localized: true,
});

const marketplaceLogos = {
  wb: {
    src: "/images/marketplaces/wildberries.webp",
    compactSrc: "/images/marketplaces/wildberries-compact.webp",
    name: "Wildberries",
  },
  oz: {
    src: "/images/marketplaces/ozon.webp",
    compactSrc: "/images/marketplaces/ozon-compact.webp",
    name: "Ozon",
  },
  ym: {
    src: "/images/marketplaces/yandex-market.webp",
    compactSrc: "/images/marketplaces/yandex-market-compact.webp",
    name: "Yandex Market",
  },
  av: {
    src: "/images/marketplaces/avito.webp",
    compactSrc: "/images/marketplaces/avito-compact.webp",
    name: "Avito",
  },
} as const;

type MarketplaceLogoKey = keyof typeof marketplaceLogos;
type Tone = "blue" | "purple" | "green" | "orange";

const tools: readonly { icon: PublicIconName; tone: Tone; title: string; text: string }[] = [
  {
    icon: "inbox",
    tone: "blue",
    title: "One customer-message queue",
    text: "Supported reviews, questions, and customer messages from connected marketplaces stay in one working queue.",
  },
  {
    icon: "sparkles",
    tone: "purple",
    title: "AI-assisted drafts with context",
    text: "AI helps draft a reply using the customer message, available product context, and your workspace settings.",
  },
  {
    icon: "shield-check",
    tone: "green",
    title: "Review before sending",
    text: "Replies that need judgment can be routed to a person before they are sent.",
  },
  {
    icon: "lightning",
    tone: "orange",
    title: "Rule-based automation",
    text: "Set conditions and priorities so routine cases can move automatically while exceptions stay under team review.",
  },
  {
    icon: "users",
    tone: "blue",
    title: "Assignments",
    text: "Assign customer messages to teammates and separate your own work from the shared queue.",
  },
  {
    icon: "chart",
    tone: "blue",
    title: "Analytics",
    text: "Track message volume, sent replies, response time, negative reviews, and marketplace-level activity.",
  },
  {
    icon: "check-circle",
    tone: "purple",
    title: "Workflow status",
    text: "See where a reply is needed, a draft is ready, review is required, an issue occurred, or the conversation is already handled.",
  },
  {
    icon: "search",
    tone: "purple",
    title: "Search and filters",
    text: "Filter by marketplace, type, status, rating, or assignee, and search by product, seller SKU, or message text.",
  },
];

const workflow = [
  {
    icon: null,
    marketplaces: true,
    title: "Customer message on a marketplace",
    text: "A customer leaves a review, asks a question, or sends a supported message.",
  },
  {
    icon: "inbox" as PublicIconName,
    marketplaces: false,
    title: "Everything enters one MPReply queue",
    text: "Supported customer messages from connected marketplaces are brought into one queue.",
  },
  {
    icon: "sparkles" as PublicIconName,
    marketplaces: false,
    title: "AI helps draft the reply",
    text: "MPReply prepares a draft using the message and available product context.",
  },
  {
    icon: "send" as PublicIconName,
    marketplaces: false,
    title: "Reply is sent",
    text: "After review, or when your automation rules allow it, the reply is sent through the marketplace connection.",
  },
] as const;

const benefits: readonly [PublicIconName, Tone, string, string][] = [
  [
    "clock",
    "purple",
    "Less repetitive typing",
    "AI-assisted drafts give the team a useful starting point for repetitive customer questions.",
  ],
  [
    "star",
    "blue",
    "A consistent team workflow",
    "Context, workflow status, and automation rules help the team handle messages consistently.",
  ],
  [
    "users",
    "purple",
    "Clear ownership",
    "Assignments and the “Assigned to me” view make ownership visible without splitting the queue.",
  ],
  [
    "chart",
    "blue",
    "Control over exceptions",
    "Routine cases can follow automation rules while ambiguous messages stay with a person.",
  ],
];

const messages: readonly [MarketplaceLogoKey, string, string, string][] = [
  ["wb", "Question", "Would this fit someone 170 cm tall?", "12 min ago"],
  ["oz", "Review", "Great quality and fast delivery.", "28 min ago"],
  ["ym", "Message", "When will this be back in stock?", "1 hour ago"],
  ["av", "Question", "Can I return this item?", "2 hours ago"],
];

function CompactMarketplaceLogo({
  marketplace,
  className,
  decorative = false,
}: {
  marketplace: MarketplaceLogoKey;
  className: string;
  decorative?: boolean;
}) {
  const logo = marketplaceLogos[marketplace];

  return (
    <Image
      className={className}
      src={logo.compactSrc}
      width={64}
      height={64}
      alt={decorative ? "" : logo.name}
      aria-hidden={decorative || undefined}
      unoptimized
    />
  );
}

export default function FeaturesPage() {
  return (
    <PublicShell locale="en">
      <div className="mockup-page">
        <section className="features-mockup-hero mockup-hero">
          <div className="public-container mockup-hero-grid">
            <div className="mockup-hero-copy">
              <p className="mockup-eyebrow">One workflow for marketplace customer messages</p>
              <h1>Everything your team needs to handle marketplace customer messages</h1>
              <p>
                MPReply combines the queue, AI-assisted drafting, review controls, assignments, and automation in one seller-team workflow.
              </p>
              <div className="mockup-actions">
                <Link className="button button-primary" href="/en/auth/register?intent=connect-marketplace">
                  Start free <span aria-hidden="true">→</span>
                </Link>
                <Link className="button button-secondary" href="/en/demo">
                  <PublicIcon name="play" className="public-inline-icon" /> View demo
                </Link>
              </div>
              <div className="mockup-trust-row" aria-label="Getting started">
                <span>14-day trial</span>
                <span>Review before sending</span>
                <span>Quick setup</span>
              </div>
            </div>

            <div
              className="features-mockup-scene"
              role="img"
              aria-label="MPReply unified queue with customer messages from four marketplaces"
            >
              <div className="features-window">
                <aside className="features-app-sidebar" aria-hidden="true">
                  <div className="features-app-brand">
                    <PublicBrandMark />
                    <strong>MPReply</strong>
                  </div>
                  <nav className="features-app-nav">
                    <strong className="features-app-nav-item is-active">
                      <PublicIcon name="inbox" />
                      All messages
                      <b>24</b>
                    </strong>
                    <span className="features-app-nav-item"><PublicIcon name="message" />Reviews</span>
                    <span className="features-app-nav-item"><PublicIcon name="message" />Questions</span>
                    <span className="features-app-nav-item"><PublicIcon name="message" />Messages</span>
                    <i />
                    <span className="features-app-nav-item"><PublicIcon name="chart" />Analytics</span>
                    <span className="features-app-nav-item"><PublicIcon name="lightning" />Automation</span>
                    <span className="features-app-nav-item"><PublicIcon name="shield-check" />Needs review</span>
                  </nav>
                </aside>

                <div className="features-app-main">
                  <div className="features-feed-tabs" aria-hidden="true">
                    <span>All <b>24</b></span>
                    <span>Reviews <b>12</b></span>
                    <span>Questions <b>8</b></span>
                    <span>Messages <b>4</b></span>
                  </div>

                  <div className="features-feed">
                    {messages.map(([marketplace, kind, text, time]) => (
                      <div className="features-message" key={`${marketplace}-${text}`}>
                        <span className="features-message-source">
                          <CompactMarketplaceLogo marketplace={marketplace} className="features-market-logo" />
                        </span>
                        <div>
                          <strong>{kind}</strong>
                          <p>{text}</p>
                        </div>
                        <small>{time}</small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="features-hero-note features-hero-note-primary" aria-hidden="true">
                All messages
                <br />
                in one workspace
                <span>↙</span>
              </div>
              <div className="features-hero-note features-hero-note-ai" aria-hidden="true">
                Context-aware drafts
                <br />
                message and product
                <span>↙</span>
              </div>
              <div className="mockup-mascot" aria-hidden="true" />
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="mockup-section-head">
              <p className="mockup-eyebrow">Features</p>
              <h2>Tools for the complete reply workflow</h2>
              <p>MPReply keeps the queue, AI-assisted drafting, automation, and review controls in one operating flow.</p>
            </div>
            <div className="features-tool-grid">
              {tools.map((tool) => (
                <article className="features-tool-card" key={tool.title}>
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
            <div className="mockup-section-head">
              <p className="mockup-eyebrow">How it works</p>
              <h2>From incoming message to sent reply</h2>
              <p>MPReply brings in the customer message, prepares a draft, and keeps the final sending decision under control.</p>
            </div>
            <div className="features-workflow">
              {workflow.map((step, index) => (
                <article className="features-workflow-card" key={step.title}>
                  <span className="mockup-step-number">{index + 1}</span>
                  {step.marketplaces ? (
                    <span className="features-workflow-logos" aria-label="Wildberries, Ozon, Yandex Market, and Avito">
                      {(Object.keys(marketplaceLogos) as MarketplaceLogoKey[]).map((marketplace) => (
                        <span className="features-workflow-logo-chip" key={marketplace}>
                          <CompactMarketplaceLogo
                            marketplace={marketplace}
                            className="features-workflow-logo"
                            decorative
                          />
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className={`mockup-icon-chip ${index === 2 ? "purple" : ""}`} aria-hidden="true">
                      <PublicIcon name={step.icon} />
                    </span>
                  )}
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="mockup-section-head">
              <p className="mockup-eyebrow">Daily workflow</p>
              <h2>What changes in day-to-day work</h2>
            </div>
            <div className="features-benefit-grid">
              {benefits.map(([icon, tone, title, text]) => (
                <article className="features-benefit-card" key={title}>
                  <span
                    className={`mockup-icon-chip features-benefit-icon ${tone === "blue" ? "" : tone}`}
                    aria-hidden="true"
                  >
                    <PublicIcon name={icon} />
                  </span>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section public-cta-section">
          <div className="public-container">
            <div className="mockup-cta-strip features-cta-strip">
              <div className="mockup-cta-strip-copy">
                <p className="mockup-eyebrow">Ready to try it?</p>
                <h2>Bring your marketplace reply workflow into MPReply</h2>
                <p>14-day trial. Send automatically where allowed, or review before sending.</p>
              </div>
              <div className="mockup-cta-strip-side">
                <Link className="button button-primary" href="/en/auth/register?intent=connect-marketplace">
                  Start free <span aria-hidden="true">→</span>
                </Link>
                <Link className="text-link" href="/en/marketplaces">
                  Explore integrations →
                </Link>
                <div className="mockup-trust-row" aria-label="Getting started">
                  <span>Quick setup</span>
                  <span>14-day trial</span>
                  <span>Review before sending</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
