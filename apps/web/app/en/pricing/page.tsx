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
    path: "/marketplaces/wildberries",
    compactSrc: "/images/marketplaces/wildberries-compact.webp",
  },
  {
    name: "Ozon",
    path: "/marketplaces/ozon",
    compactSrc: "/images/marketplaces/ozon-compact.webp",
  },
  {
    name: "Yandex Market",
    path: "/marketplaces/yandex-market",
    compactSrc: "/images/marketplaces/yandex-market-compact.webp",
  },
  {
    name: "Avito",
    path: "/marketplaces/avito",
    compactSrc: "/images/marketplaces/avito-compact.webp",
  },
] as const;

function renderComparisonValue(value: string) {
  return value === "✓" ? <span className="pricing-comparison-check">✓</span> : value;
}

export default function PricingPage() {
  return (
    <PublicShell locale="en">
      <div className="mockup-page">
        <section className="pricing-mockup-hero">
          <div className="public-container">
            <p className="mockup-eyebrow">Pricing</p>
            <h1>Straightforward plans for different workloads</h1>
            <p>
              Choose a plan based on monthly message volume, team size, and the number of marketplaces you need to connect.
            </p>

            <div className="pricing-toggle-wrap">
              <div className="pricing-toggle" aria-label="Billing period">
                <span>Monthly</span>
                <span>Annual · -20%</span>
              </div>
              <div className="pricing-hero-note" aria-hidden="true">
                Fewer context switches
                <br />
                between seller panels
                <span>↙</span>
              </div>
            </div>

            <div className="pricing-card-grid">
              {plans.map((plan) => (
                <article className={`pricing-card${plan.popular ? " is-popular" : ""}`} key={plan.name}>
                  <h2>{plan.name}</h2>
                  <p>{plan.description}</p>
                  <div className="pricing-price">
                    <strong>{plan.price}</strong>
                    <span>/ mo</span>
                  </div>
                  <Link
                    className={`button ${plan.popular ? "button-primary" : "button-secondary"}`}
                    href="/en/auth/register?intent=connect-marketplace"
                  >
                    Start free
                  </Link>
                  <ul className="pricing-feature-list">
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <div className="pricing-custom-strip">
              <span className="pricing-custom-icon" aria-hidden="true">
                <PublicIcon name="shield-check" />
              </span>
              <div>
                <strong>Need to discuss your setup?</strong>
                <span>
                  If you manage several seller accounts, a larger team, or a less standard workflow, describe your setup and we can discuss how MPReply fits.
                </span>
              </div>
              <Link className="button button-secondary" href="/en/contacts">
                Talk to us
              </Link>
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Integrations</p>
              <h2>4 marketplaces in MPReply</h2>
              <p>Wildberries, Ozon, Yandex Market, and Avito are represented in one product and one shared customer-message workflow.</p>
            </div>
            <div className="pricing-market-row">
              {marketplaces.map((marketplace) => (
                <Link
                  className="pricing-market-chip"
                  href={marketplace.path}
                  key={marketplace.name}
                  aria-label={`${marketplace.name} integration`}
                >
                  <Image
                    className="pricing-market-compact"
                    src={marketplace.compactSrc}
                    width={64}
                    height={64}
                    alt=""
                    aria-hidden="true"
                    unoptimized
                  />
                  <strong className="pricing-market-name">{marketplace.name}</strong>
                </Link>
              ))}
            </div>
            <p className="pricing-market-note">
              Availability of a specific connection depends on the current product version; see the integrations page for details.
            </p>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="render-section-head">
              <p className="mockup-eyebrow">Compare plans</p>
              <h2>Choose the plan that matches your workflow</h2>
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

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="pricing-faq-heading">
              <div className="render-section-head pricing-faq-head">
                <p className="mockup-eyebrow">Questions</p>
                <h2>Frequently asked questions</h2>
              </div>
              <Link className="pricing-all-questions" href="/en/help">
                All questions <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="pricing-faq">
              {faq.map(([question, answer]) => (
                <details key={question}>
                  <summary className="pricing-faq-summary">
                    <span>{question}</span>
                    <span className="pricing-faq-chevron" aria-hidden="true">⌄</span>
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section public-cta-section">
          <div className="public-container">
            <div className="pricing-final-cta">
              <div>
                <p className="mockup-eyebrow">Get started</p>
                <h2>Try MPReply free</h2>
                <p>Connect the marketplaces available to your account, set up the workflow, and see how the team can handle customer messages from one place.</p>
                <div className="mockup-actions">
                  <Link className="button button-primary" href="/en/auth/register?intent=connect-marketplace">
                    Start free
                  </Link>
                  <Link className="button button-secondary" href="/en/demo">
                    View demo
                  </Link>
                </div>
                <div className="mockup-trust-row" aria-label="Getting started">
                  <span>14-day trial</span>
                  <span>4 marketplaces in MPReply</span>
                  <span>Automation or review before sending</span>
                </div>
              </div>
              <div className="pricing-final-visual" aria-hidden="true">
                <div className="pricing-final-logo-cloud">
                  {marketplaces.slice(0, 3).map((marketplace) => (
                    <span className="pricing-final-logo-chip" key={marketplace.name}>
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
                <div className="pricing-final-review">
                  <strong>Great product!</strong>
                  <span>★★★★★</span>
                </div>
                <div className="pricing-final-answer">
                  <p>Thanks for your review! We’re glad you liked the product and hope to see you again.</p>
                </div>
                <span className="pricing-final-sparkle">
                  <PublicIcon name="sparkles" />
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
