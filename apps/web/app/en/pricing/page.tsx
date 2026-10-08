import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PublicIcon } from "../../../components/public-site/PublicIcon";
import { PricingCalculators } from "../../../components/public-site/PricingCalculators";
import { PublicShell } from "../../../components/public-site/PublicShell";
import { createPageMetadata } from "../../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "MPReply pricing — plans from 1 290 ₽ per month",
  description:
    "Compare Start, Team, Business, and Corporate plans. The 14-day trial includes 350 AI replies. Corporate pricing is agreed individually.",
  path: "/pricing",
  locale: "en",
  localized: true,
});

const plans = [
  {
    name: "Start",
    price: "1 290 ₽",
    description: "For smaller stores getting started",
    popular: false,
    features: [
      "300 AI-generated replies per month",
      "Up to 2 users",
      "Connect up to 2 marketplaces",
      "AI auto-replies with context",
      "Review before sending",
      "Rule-based automation",
      "Analytics",
    ],
  },
  {
    name: "Team",
    price: "3 490 ₽",
    description: "For growing seller teams",
    popular: true,
    features: [
      "800 AI-generated replies per month",
      "Up to 10 users",
      "Connect up to 5 marketplaces",
      "AI auto-replies with context",
      "Review before sending",
      "Rule-based automation",
      "Analytics",
    ],
  },
  {
    name: "Business",
    price: "6 990 ₽",
    description: "For larger teams",
    popular: false,
    features: [
      "1,600 AI-generated replies per month",
      "Unlimited users",
      "Connect all 4 marketplaces",
      "AI auto-replies with context",
      "Review before sending",
      "Rule-based automation",
      "Analytics",
    ],
  },
  {
    name: "Corporate",
    price: "Custom price",
    description: "For teams with a high volume of customer requests",
    popular: false,
    features: [
      "Reply volume based on your needs",
      "Pricing agreed individually",
      "Wildberries, Ozon, Yandex Market, and Avito",
      "One customer-request queue",
      "Processing rules and reply review",
      "Contact us through the website form",
    ],
  },
] as const;

const comparison = [
  ["AI-generated replies per month", "300", "800", "1,600"],
  ["Unused AI replies", "Carry over", "Carry over", "Carry over"],
  ["Users", "up to 2", "up to 10", "unlimited"],
  ["Marketplaces", "up to 2", "up to 5", "all 4"],
  ["AI auto-replies with context", "✓", "✓", "✓"],
  ["Review before sending", "✓", "✓", "✓"],
  ["Rule-based automation", "✓", "✓", "✓"],
  ["Analytics", "✓", "✓", "✓"],
] as const;

const faq = [
  [
    "Do unused AI replies expire?",
    "Paid replies carry over without an expiry date and can be used with an active paid plan. The 350 trial replies expire after 14 days. Each new AI-generated draft uses one reply.",
  ],
  ["Can I try MPReply before paying?", "Yes. The 14-day trial includes 350 AI replies."],
  [
    "What changes between plans?",
    "Plans differ by monthly AI reply allowances, number of users, and how many marketplaces can be connected.",
  ],
  [
    "Which marketplaces are represented in MPReply?",
    "MPReply is designed to work with Wildberries, Ozon, Yandex Market, and Avito. Availability of a specific connection depends on the current product version.",
  ],
  ["Is there an annual discount?", "Yes. Annual payment includes a 20% discount."],
  [
    "How many AI replies are included?",
    "Start includes 300 AI replies per month, Team 800, and Business 1,600.",
  ],
  [
    "How many users can I add?",
    "Start includes up to 2 users, Team up to 10 users, and Business has no user-count limit in the current public pricing matrix.",
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

function renderComparisonValue(value: string) {
  return value === "✓" ? <span className="pricing-comparison-check">✓</span> : value;
}

const planIcons = ["send", "users", "chart", "shield-check"] as const;

const startBenefits = [
  ["clock", "14-day trial", "350 AI replies to evaluate the workflow on your own requests."],
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

                <h1>Straightforward plans for different workloads</h1>
                <p>
                  Choose a plan based on monthly message volume, team size, and the number of marketplaces you need to connect.
                </p>
                <div className="mockup-trust-row" role="group" aria-label="Getting started">
                  <span>14-day trial</span>
                  <span>20% off annual payment</span>
                  <span>Review before sending</span>
                </div>
              </div>

              <div className="pricing-approved-hero-scene supplied-hero-scene">
                <Image
                  alt="MPReply with four supported marketplaces"
                  className="supplied-hero-image"
                  src="/images/approved/05-pricing-hero.avif"
                  width={1794}
                  height={877}
                  sizes="(max-width: 1100px) 100vw, 50vw"
                  priority
                  unoptimized
                />
              </div>
            </div>
          </div>
        </section>

        <section className="pricing-plans-section" aria-labelledby="pricing-plans-title">
          <div className="public-container">
            <div className="pricing-plans-heading">
              <h2 id="pricing-plans-title">Plans and prices</h2>
              <p>Choose the AI reply allowance your team needs. Unused replies carry over.</p>
            </div>
            <div className="pricing-card-grid">
              {plans.map((plan, index) => (
                <article className={`pricing-card${plan.popular ? " is-popular" : ""}`} key={plan.name}>
                  {plan.popular ? <span className="pricing-card-popular">Popular choice</span> : null}
                  <span className="pricing-plan-card-icon" aria-hidden="true">
                    <PublicIcon name={planIcons[index]} />
                  </span>
                  <h3>{plan.name}</h3>
                  <p>{plan.description}</p>
                  <div className="pricing-price">
                    <strong>{plan.price}</strong>
                    {index !== 3 ? <span>/ mo</span> : null}
                  </div>
                  <ul className="pricing-feature-list">
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <Link
                    className={`button ${plan.popular ? "button-primary" : "button-secondary"}`}
                    href={index === 3 ? "/en/contacts#contact-form" : "/en/auth/register?intent=connect-marketplace"}
                  >
                    {index === 3 ? "Discuss your plan" : "Start free"} <span aria-hidden="true">→</span>
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <PricingCalculators locale="en" />

        <section className="public-section">
          <div className="public-container">
            <div className="render-section-head">

              <h2>Choose the plan that matches your workflow</h2>
              <p>Every plan uses the same MPReply workflow and differs by the limits available to the workspace.</p>
            </div>
            <div className="pricing-comparison">
              <table>
                <thead>
                  <tr>
                    <th>Features</th>
                    <th>Start</th>
                    <th>Team</th>
                    <th>Business</th>
                    <th>Corporate</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map(([feature, start, pro, business]) => (
                    <tr key={feature}>
                      <td>{feature}</td>
                      <td data-plan="Start">{renderComparisonValue(start)}</td>
                      <td data-plan="Team">{renderComparisonValue(pro)}</td>
                      <td data-plan="Business">{renderComparisonValue(business)}</td>
                      <td data-plan="Corporate">By agreement</td>
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

              <h2>Everything you need to get started</h2>
            </div>
            <div className="pricing-approved-start-grid">
              {startBenefits.map(([icon, title, text]) => (
                <div className="pricing-approved-start-card" key={title}>
                  <span className="mockup-icon-chip" aria-hidden="true"><PublicIcon name={icon} /></span>
                  <div><strong>{title}</strong><p>{text}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section pricing-approved-faq-section">
          <div className="public-container pricing-approved-faq-layout">
            <div className="render-section-head">
              <h2>Answers to common questions</h2>
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

      </div>
    </PublicShell>
  );
}
