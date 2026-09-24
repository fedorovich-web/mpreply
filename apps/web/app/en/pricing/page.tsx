import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PublicIcon } from "../../../components/public-site/PublicIcon";
import { PublicShell } from "../../../components/public-site/PublicShell";
import { createPageMetadata } from "../../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "MPReply pricing — plans from 490 ₽ per month",
  description:
    "Compare MPReply plans for marketplace seller teams: Start, Professional, and Business, with a 14-day trial and a 20% annual-payment discount.",
  path: "/pricing",
  locale: "en",
  localized: true,
});

const plans = [
  {
    name: "Start",
    price: "490 ₽",
    description: "For smaller stores getting started",
    popular: false,
    features: [
      "Up to 500 messages per month",
      "1 user",
      "Connect up to 2 marketplaces",
      "AI-assisted drafts with context",
      "Review before sending",
      "Rule-based automation",
      "Analytics",
    ],
  },
  {
    name: "Professional",
    price: "990 ₽",
    description: "For growing seller teams",
    popular: true,
    features: [
      "Up to 2,000 messages per month",
      "Up to 3 users",
      "Connect up to 4 marketplaces",
      "AI-assisted drafts with context",
      "Review before sending",
      "Rule-based automation",
      "Analytics",
    ],
  },
  {
    name: "Business",
    price: "1 990 ₽",
    description: "For larger teams",
    popular: false,
    features: [
      "Up to 10,000 messages per month",
      "Unlimited users",
      "Connect all 4 marketplaces",
      "AI-assisted drafts with context",
      "Review before sending",
      "Rule-based automation",
      "Analytics",
    ],
  },
] as const;

const comparison = [
  ["Messages per month", "up to 500", "up to 2,000", "up to 10,000"],
  ["Users", "1", "up to 3", "unlimited"],
  ["Marketplaces", "up to 2", "up to 4", "all 4"],
  ["AI-assisted drafts with context", "✓", "✓", "✓"],
  ["Review before sending", "✓", "✓", "✓"],
  ["Rule-based automation", "✓", "✓", "✓"],
  ["Analytics", "✓", "✓", "✓"],
] as const;

const faq = [
  ["Can I try MPReply before paying?", "Yes. MPReply includes a 14-day trial."],
  [
    "What changes between plans?",
    "The public plan matrix differs mainly by monthly message limits, number of users, and how many marketplaces can be connected.",
  ],
  [
    "Which marketplaces are represented in MPReply?",
    "MPReply is designed to work with Wildberries, Ozon, Yandex Market, and Avito. Availability of a specific connection depends on the current product version.",
  ],
  ["Is there an annual discount?", "Yes. Annual payment includes a 20% discount."],
  [
    "What are the monthly message limits?",
    "Start includes up to 500 messages per month, Professional up to 2,000, and Business up to 10,000.",
  ],
  [
    "How many users can I add?",
    "Start includes 1 user, Professional up to 3 users, and Business has no user-count limit in the current public pricing matrix.",
  ],
  [
    "What happens after I create an account?",
    "The next step is to connect the marketplace you need and start working from one customer-message workspace.",
  ],
  [
    "Can I see the product first?",
    "Yes. The demo page shows a sample flow from receiving a customer message to AI-assisted drafting, review, or automated handling.",
  ],
] as const;

const marketplaces = [
  {
    name: "Wildberries",
    path: "/en/marketplaces/wildberries",
    compactSrc: "/images/marketplaces/wildberries-compact.webp",
  },
  {
    name: "Ozon",
    path: "/en/marketplaces/ozon",
    compactSrc: "/images/marketplaces/ozon-compact.webp",
  },
  {
    name: "Yandex Market",
    path: "/en/marketplaces/yandex-market",
    compactSrc: "/images/marketplaces/yandex-market-compact.webp",
  },
  {
    name: "Avito",
    path: "/en/marketplaces/avito",
    compactSrc: "/images/marketplaces/avito-compact.webp",
  },
] as const;

function renderComparisonValue(value: string) {
  return value === "✓" ? <span className="pricing-comparison-check">✓</span> : value;
}

const planIcons = ["send", "users", "chart"] as const;

const startBenefits = [
  ["clock", "14-day trial", "Evaluate the MPReply workflow before moving to a paid plan."],
  ["link", "4 marketplaces in MPReply", "Wildberries, Ozon, Yandex Market, and Avito use one shared customer-message workflow."],
  ["shield-check", "Review before sending", "Keep ambiguous replies under team review when automatic sending is not appropriate."],
] as const;

export default function PricingPage() {
  return (
    <PublicShell locale="en">
      <div className="mockup-page">
        <section className="pricing-mockup-hero">
          <div className="public-container">
            <div className="pricing-approved-hero-grid">
              <div className="pricing-approved-hero-copy">
                <p className="mockup-eyebrow">MPReply pricing</p>
                <h1>Straightforward plans for different workloads</h1>
                <p>
                  Choose a plan based on monthly message volume, team size, and the number of marketplaces you need to connect.
                </p>
                <div className="mockup-trust-row" aria-label="Getting started">
                  <span>14-day trial</span>
                  <span>20% off annual payment</span>
                  <span>Review before sending</span>
                </div>
              </div>

              <div className="pricing-approved-hero-scene" aria-hidden="true">
                <div className="pricing-approved-hero-blob" />
                <Image
                  className="pricing-approved-hero-mascot"
                  src="/images/mpreply-mascot.webp"
                  width={320}
                  height={320}
                  alt=""
                  priority
                />
                <div className="pricing-approved-market-card">
                  <strong>One workspace for every marketplace</strong>
                  <div>
                    {marketplaces.map((marketplace) => (
                      <span className="pricing-approved-market-logo" key={marketplace.name}>
                        <Image
                          className="pricing-market-compact"
                          src={marketplace.compactSrc}
                          width={64}
                          height={64}
                          alt=""
                          unoptimized
                        />
                      </span>
                    ))}
                  </div>
                </div>
                <span className="pricing-approved-note pricing-approved-note-top">One system for the team</span>
                <span className="pricing-approved-note pricing-approved-note-side">Fewer context switches</span>
              </div>
            </div>

            <div className="pricing-card-grid">
              {plans.map((plan, index) => (
                <article className={`pricing-card${plan.popular ? " is-popular" : ""}`} key={plan.name}>
                  {plan.popular ? <span className="pricing-card-popular">Popular choice</span> : null}
                  <span className="pricing-plan-card-icon" aria-hidden="true">
                    <PublicIcon name={planIcons[index]} />
                  </span>
                  <h2>{plan.name}</h2>
                  <p>{plan.description}</p>
                  <div className="pricing-price">
                    <strong>{plan.price}</strong>
                    <span>/ mo</span>
                  </div>
                  <ul className="pricing-feature-list">
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <Link
                    className={`button ${plan.popular ? "button-primary" : "button-secondary"}`}
                    href="/en/auth/register?intent=connect-marketplace"
                  >
                    Start free <span aria-hidden="true">→</span>
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Compare plans</p>
              <h2>Choose the plan that matches your workflow</h2>
              <p>Every plan uses the same MPReply workflow and differs by the limits available to the workspace.</p>
            </div>
            <div className="pricing-comparison">
              <table>
                <thead>
                  <tr>
                    <th>Features</th>
                    <th>Start</th>
                    <th>Professional</th>
                    <th>Business</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map(([feature, start, pro, business]) => (
                    <tr key={feature}>
                      <td>{feature}</td>
                      <td>{renderComparisonValue(start)}</td>
                      <td>{renderComparisonValue(pro)}</td>
                      <td>{renderComparisonValue(business)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft pricing-approved-start-section">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Start with confidence</p>
              <h2>Everything you need to get started</h2>
            </div>
            <div className="pricing-approved-start-grid">
              {startBenefits.map(([icon, title, text]) => (
                <article className="pricing-approved-start-card" key={title}>
                  <span className="mockup-icon-chip" aria-hidden="true"><PublicIcon name={icon} /></span>
                  <div><strong>{title}</strong><p>{text}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section pricing-approved-faq-section">
          <div className="public-container pricing-approved-faq-layout">
            <div className="pricing-approved-faq-copy">
              <p className="mockup-eyebrow">Frequently asked questions</p>
              <h2>Answers to common questions</h2>
              <Link className="pricing-all-questions" href="/en/help">
                All questions <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="pricing-faq">
              {faq.map(([question, answer]) => (
                <details key={question}>
                  <summary className="pricing-faq-summary">
                    <span>{question}</span>
                    <span className="pricing-faq-chevron" aria-hidden="true">+</span>
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section public-cta-section">
          <div className="public-container">
            <div className="pricing-final-cta pricing-approved-final-cta">
              <span className="pricing-approved-final-icon" aria-hidden="true"><PublicIcon name="send" /></span>
              <div className="pricing-approved-final-copy">
                <h2>Start using MPReply today</h2>
                <p>14-day trial. Use automation where appropriate, or review replies before sending.</p>
              </div>
              <div className="pricing-approved-final-actions">
                <Link className="button button-primary" href="/en/auth/register?intent=connect-marketplace">
                  Start free <span aria-hidden="true">→</span>
                </Link>
                <Link className="text-link" href="/en/demo">View demo →</Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
