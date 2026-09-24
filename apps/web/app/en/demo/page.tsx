import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PublicIcon, type PublicIconName } from "../../../components/public-site/PublicIcon";
import { PublicShell } from "../../../components/public-site/PublicShell";
import { createPageMetadata } from "../../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "MPReply demo — see the customer-message workflow",
  description:
    "See a sample MPReply workflow from incoming marketplace message to available context, AI-assisted draft, review, and sending.",
  path: "/demo",
  locale: "en",
  localized: true,
});

const logos = {
  wb: {
    name: "Wildberries",
    src: "/images/marketplaces/wildberries.webp",
    compactSrc: "/images/marketplaces/wildberries-compact.webp",
    width: 432,
    height: 188,
  },
  oz: {
    name: "Ozon",
    src: "/images/marketplaces/ozon.webp",
    compactSrc: "/images/marketplaces/ozon-compact.webp",
    width: 436,
    height: 198,
  },
  ym: {
    name: "Yandex Market",
    src: "/images/marketplaces/yandex-market.webp",
    compactSrc: "/images/marketplaces/yandex-market-compact.webp",
    width: 554,
    height: 222,
  },
  av: {
    name: "Avito",
    src: "/images/marketplaces/avito.webp",
    compactSrc: "/images/marketplaces/avito-compact.webp",
    width: 504,
    height: 212,
  },
} as const;

type MarketplaceLogoKey = keyof typeof logos;

function CompactMarketplaceLogo({
  marketplace,
  size = 36,
  decorative = false,
}: {
  marketplace: MarketplaceLogoKey;
  size?: number;
  decorative?: boolean;
}) {
  const logo = logos[marketplace];

  return (
    <Image
      className="demo-marketplace-compact"
      src={logo.compactSrc}
      width={64}
      height={64}
      alt={decorative ? "" : logo.name}
      aria-hidden={decorative || undefined}
      unoptimized
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}

const journey: readonly [PublicIconName, string, string][] = [
  [
    "message",
    "Receive the customer message",
    "A supported review, question, or customer message arrives from the connected marketplace in the MPReply queue.",
  ],
  [
    "document",
    "Review available context",
    "MPReply uses the customer message, available product context, and workspace settings.",
  ],
  [
    "sparkles",
    "AI-assisted draft",
    "AI prepares a draft using the available context and workspace settings.",
  ],
  [
    "send",
    "Review and send",
    "The reply can be reviewed and edited before sending, or handled automatically when your rules allow it.",
  ],
];

const scenarios = [
  {
    marketplace: "wb" as MarketplaceLogoKey,
    type: "Review",
    popular: true,
    text: "A customer leaves a product review. See how MPReply moves it through the queue, draft, and review steps.",
  },
  {
    marketplace: "oz" as MarketplaceLogoKey,
    type: "Question",
    popular: false,
    text: "A customer asks about a product, delivery, or availability. MPReply drafts a reply only from the context available to the workflow.",
  },
  {
    marketplace: "ym" as MarketplaceLogoKey,
    type: "Message",
    popular: false,
    text: "A customer message enters the shared queue with its text, workflow status, and available product context.",
  },
] as const;

const processEvents: readonly [PublicIconName, "green" | "blue" | "purple", string, string, string][] = [
  ["download", "green", "Received", "Mar 12, 14:32", "Demo: customer message received from Ozon"],
  ["search", "blue", "Context", "Mar 12, 14:32", "Demo: available message and product context reviewed"],
  ["sparkles", "purple", "AI-assisted draft", "Mar 12, 14:33", "Draft prepared and sent for review"],
  ["users", "purple", "Reviewed", "Mar 12, 14:34", "Reply reviewed by a teammate"],
  ["check-circle", "green", "Sent", "Mar 12, 14:35", "Demo: final state after sending"],
];

const teamTools: readonly [PublicIconName, "blue" | "purple" | "orange", string, string][] = [
  [
    "users",
    "purple",
    "One customer-message queue",
    "Supported reviews, questions, and customer messages from connected marketplaces stay in one workspace.",
  ],
  [
    "users",
    "blue",
    "Assignments",
    "Assign customer messages to teammates and separate your own work from the shared queue.",
  ],
  [
    "lightning",
    "orange",
    "Rule-based automation",
    "Set conditions for automated handling while keeping ambiguous cases under team review.",
  ],
  [
    "chart",
    "blue",
    "Analytics",
    "Track message volume, sent replies, response time, and connected-marketplace activity.",
  ],
];

export default function DemoPage() {
  return (
    <PublicShell locale="en">
      <div className="mockup-page">
        <section className="demo-mockup-hero">
          <div className="public-container demo-mockup-grid">
            <div className="demo-mockup-copy">
              <p className="mockup-eyebrow">MPReply demo</p>
              <h1>See how MPReply handles a customer message from intake to reply</h1>
              <p>
                This sample workflow shows a marketplace customer message entering MPReply, using the available
                context for an AI-assisted draft, then moving through review or automation rules.
              </p>
              <div className="mockup-actions">
                <Link className="button button-primary" href="/en/auth/register?intent=connect-marketplace">
                  Start free <span aria-hidden="true">→</span>
                </Link>
                <Link className="button button-secondary" href="#demo-process">
                  <PublicIcon name="play" className="public-inline-icon" /> View demo
                </Link>
              </div>
              <div className="mockup-trust-row">
                <span>14-day trial</span>
                <span>Review before sending</span>
                <span>Quick setup</span>
              </div>
            </div>

            <div
              className="demo-hero-story"
              role="img"
              aria-label="Sample customer-message workflow from intake to AI-assisted draft and review"
            >
              <article className="demo-story-card incoming">
                <div className="demo-story-meta">
                  <CompactMarketplaceLogo marketplace="wb" size={34} decorative />
                  <div>
                    <strong>Customer</strong>
                    <small>5 min ago</small>
                  </div>
                </div>
                <p>Hi! Do you know when this item will be back in stock?</p>
              </article>
              <span className="demo-story-arrow a1" aria-hidden="true">↘</span>
              <article className="demo-story-card ai">
                <div className="demo-story-meta demo-story-meta-ai">
                  <span className="demo-story-ai-avatar" aria-hidden="true">
                    <PublicIcon name="sparkles" />
                  </span>
                  <div>
                    <strong>MPReply AI</strong>
                    <small>Draft suggestion</small>
                  </div>
                </div>
                <p>
                  Hi! The next restock date is not available in the current context. When
                  the item is available again, the latest status will appear on the product page. Thanks for checking!
                </p>
              </article>
              <span className="demo-story-arrow a2" aria-hidden="true">→</span>
              <article className="demo-story-card review">
                <div className="demo-story-meta">
                  <span className="demo-story-review-avatar" aria-hidden="true">
                    <PublicIcon name="users" />
                  </span>
                  <div>
                    <strong>You</strong>
                    <small>Review before sending</small>
                  </div>
                </div>
                <div className="demo-story-review-bubble">
                  <strong>Draft reviewed</strong>
                  <span>Ready to send →</span>
                </div>
              </article>
              <div className="demo-hero-note" aria-hidden="true">
                Context
                <br />
                draft
                <br />
                review
                <span>↙</span>
              </div>
              <div className="mockup-mascot demo-hero-mascot" aria-hidden="true" />
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">How it works</p>
              <h2>Customer-message journey</h2>
              <p>Four clear stages from the customer message to review or sending.</p>
            </div>

            <div className="demo-journey">
              {journey.map(([icon, title, text], index) => (
                <article className="demo-journey-card" key={title}>
                  <span className="mockup-step-number">{index + 1}</span>
                  <span className={`mockup-icon-chip ${index === 2 ? "purple" : ""}`} aria-hidden="true">
                    <PublicIcon name={icon} />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>

                  {index === 0 ? (
                    <div className="demo-journey-marketplaces" aria-label="Supported marketplace integrations">
                      {(Object.keys(logos) as MarketplaceLogoKey[]).map((marketplace) => (
                        <span className="demo-journey-marketplace-chip" key={marketplace}>
                          <CompactMarketplaceLogo marketplace={marketplace} size={30} decorative />
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Sample scenarios</p>
              <h2>See different customer-message types</h2>
              <p>These are interface examples, not customer results or production statistics.</p>
            </div>

            <div className="demo-scenarios">
              {scenarios.map((scenario) => (
                <article
                  className={`demo-scenario-card${scenario.popular ? " is-popular" : ""}`}
                  key={scenario.type}
                >
                  <div className="demo-scenario-head">
                    <CompactMarketplaceLogo marketplace={scenario.marketplace} size={42} />
                    <strong>{scenario.type}</strong>
                    {scenario.popular ? <span className="demo-scenario-popular">Example</span> : null}
                  </div>
                  <p>{scenario.text}</p>
                  <a href="#demo-process">View example →</a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section" id="demo-process">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Full sample workflow</p>
              <h2>One customer message, shown end to end</h2>
              <p>This static example shows how workflow states can change as a message moves through MPReply.</p>
            </div>

            <div className="demo-process">
              <div className="demo-process-message">
                <div className="demo-scenario-head">
                  <CompactMarketplaceLogo marketplace="oz" size={38} />
                  <div>
                    <strong>Demo message #45821</strong>
                    <small>Mar 12, 14:32</small>
                  </div>
                </div>
                <div className="demo-process-buyer-message">
                  <span className="demo-process-avatar" aria-hidden="true" />
                  <p>Hi! Will this item be back in stock next week?</p>
                </div>
                <span className="demo-process-market-link">Marketplace context ↗</span>
              </div>

              <div className="demo-process-timeline">
                {processEvents.map(([icon, tone, status, time, label]) => (
                  <div className="demo-process-event" key={status}>
                    <span className={`demo-process-event-icon ${tone}`} aria-hidden="true">
                      <PublicIcon name={icon} />
                    </span>
                    <span className="demo-process-event-meta">
                      <small>{status}</small>
                      <time>{time}</time>
                    </span>
                    <strong>{label}</strong>
                  </div>
                ))}
              </div>

              <div className="demo-process-answer">
                <strong>
                  <PublicIcon name="message" className="public-inline-icon" /> Reply draft
                </strong>
                <p>
                  Hi! The next restock date is not available in the current context. When
                  the item is available again, the latest status will appear on the product page. Thanks for checking!
                </p>
                <span className="button button-secondary">Shown in full</span>
              </div>
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Team tools</p>
              <h2>What the team works with</h2>
              <p>Queue, assignments, automation rules, and analytics stay connected to the customer-message workflow.</p>
            </div>

            <div className="demo-team-tools">
              {teamTools.map(([icon, tone, title, text]) => (
                <article className="demo-team-tool" key={title}>
                  <span className={`mockup-icon-chip ${tone === "blue" ? "" : tone}`} aria-hidden="true">
                    <PublicIcon name={icon} />
                  </span>
                  <div>
                    <strong>{title}</strong>
                    <span>{text}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section public-cta-section">
          <div className="public-container">
            <div className="mockup-cta-strip demo-cta-strip">
              <span className="mockup-cta-strip-icon" aria-hidden="true">
                <PublicIcon name="send" />
              </span>
              <div className="mockup-cta-strip-copy">
                <h2>Try MPReply with your own customer messages</h2>
                <p>14-day trial. Use automation where appropriate, or review before sending.</p>
              </div>
              <div className="mockup-cta-strip-side">
                <Link className="button button-primary" href="/en/auth/register?intent=connect-marketplace">
                  Start free <span aria-hidden="true">→</span>
                </Link>
                <Link className="text-link" href="/en/marketplaces">
                  Explore integrations →
                </Link>
              </div>
              <span className="demo-cta-note" aria-hidden="true">
                See the workflow
                <br />
                with your own messages
              </span>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
