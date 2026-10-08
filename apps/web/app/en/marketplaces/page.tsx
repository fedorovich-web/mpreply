import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PublicBrandMark } from "../../../components/public-site/PublicBrandMark";
import { PublicIcon, type PublicIconName } from "../../../components/public-site/PublicIcon";
import { PublicShell } from "../../../components/public-site/PublicShell";
import { createPageMetadata } from "../../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "MPReply marketplace integrations — Wildberries, Ozon, Yandex Market, and Avito",
  description:
    "Connect Wildberries, Ozon, Yandex Market, and Avito to MPReply and handle supported customer messages in one queue with AI-assisted drafts and review controls.",
  path: "/marketplaces",
  locale: "en",
  localized: true,
});

const marketplaceLogos = {
  wb: { src: "/images/icons/final/01-wildberries.avif", width: 256, height: 256 },
  oz: { src: "/images/icons/final/02-ozon.avif", width: 256, height: 256 },
  ym: { src: "/images/icons/final/03-yandex-market.avif", width: 256, height: 256 },
  av: { src: "/images/icons/final/04-avito.avif", width: 256, height: 256 },
} as const;

const integrations = [
  {
    key: "wb",
    name: "Wildberries",
    path: "/en/marketplaces/wildberries",
    text: "Handle supported Wildberries reviews and questions in one MPReply queue with product context and review before sending.",
    points: ["Account connection", "Status updates", "Reviews and questions"],
    logo: marketplaceLogos.wb,
  },
  {
    key: "oz",
    name: "Ozon",
    path: "/en/marketplaces/ozon",
    text: "Bring supported Ozon customer messages into the shared MPReply queue and keep available context next to the reply.",
    points: ["Account connection", "Status updates", "Supported customer messages"],
    logo: marketplaceLogos.oz,
  },
  {
    key: "ym",
    name: "Yandex Market",
    path: "/en/marketplaces/yandex-market",
    text: "Handle supported Yandex Market customer messages in MPReply while keeping message type, status, and available context visible.",
    points: ["Account connection", "Status updates", "Supported customer messages"],
    logo: marketplaceLogos.ym,
  },
  {
    key: "av",
    name: "Avito",
    path: "/en/marketplaces/avito",
    text: "Handle supported Avito buyer conversations in the shared MPReply queue with listing context.",
    points: ["Account connection", "Conversation status", "Supported messages"],
    logo: marketplaceLogos.av,
  },
] as const;

const benefits: readonly [PublicIconName, string, string, string][] = [
  [
    "inbox",
    "blue",
    "One customer-message queue",
    "Supported customer messages from connected marketplaces stay in one workspace.",
  ],
  [
    "sync",
    "blue",
    "Status updates",
    "MPReply updates available marketplace data and keeps the current message status visible in the shared queue.",
  ],
  [
    "sparkles",
    "purple",
    "AI auto-replies with context",
    "AI helps draft a reply from the customer message, available product context, and workspace settings.",
  ],
  [
    "users",
    "purple",
    "Assignments and review controls",
    "Assign messages, filter the queue, and keep ambiguous cases under team review.",
  ],
];

const connectSteps: readonly [PublicIconName, string, string][] = [
  ["link", "Choose a marketplace", "Open the integration you need and start connecting the seller account."],
  ["gear", "Add the connection", "Enter the access details required by the supported connection method for that marketplace."],
  [
    "chart",
    "Work from the shared queue",
    "Supported customer messages appear in MPReply with workflow status and available context for the next action.",
  ],
];

function MarketplaceLogo({
  marketplace,
  className,
  decorative = false,
}: {
  marketplace: keyof typeof marketplaceLogos;
  className: string;
  decorative?: boolean;
}) {
  const logo = marketplaceLogos[marketplace];
  const integration = integrations.find((item) => item.key === marketplace);

  return (
    <Image
      className={className}
      src={logo.src}
      width={logo.width}
      height={logo.height}
      alt={decorative ? "" : integration?.name ?? ""}
      aria-hidden={decorative || undefined}
      unoptimized
    />
  );
}

export default function MarketplacesPage() {
  return (
    <PublicShell locale="en">
      <div className="mockup-page">
        <section className="marketplaces-mockup-hero mockup-hero">
          <div className="public-container mockup-hero-grid">
            <div className="mockup-hero-copy">

              <h1>
                Connect marketplaces <span className="mockup-highlight">to one workspace</span>
              </h1>
              <p>
                Bring supported customer messages from Wildberries, Ozon, Yandex Market, and Avito into one workspace. Draft replies with AI and keep exceptions under team review.
              </p>
              <div className="mockup-actions">
                <Link className="button button-primary" href="/en/auth/register?intent=connect-marketplace">
                  Start free <span aria-hidden="true">→</span>
                </Link>
                <Link className="button button-secondary" href="/en/demo">
                  <PublicIcon name="play" className="public-inline-icon" /> View demo
                </Link>
              </div>
              <div className="mockup-trust-row" role="group" aria-label="Getting started">
                <span>4 marketplaces</span>
                <span>14-day trial</span>
                <span>Review before sending</span>
              </div>
            </div>

            <div
              className="marketplace-hub-scene"
              role="img"
              aria-label="MPReply connects four marketplaces to one customer-message workflow"
            >
              <span className="marketplace-hub-line l1" aria-hidden="true" />
              <span className="marketplace-hub-line l2" aria-hidden="true" />
              <span className="marketplace-hub-line l3" aria-hidden="true" />
              <span className="marketplace-hub-line l4" aria-hidden="true" />

              <div className="marketplace-hub-core">
                <div className="marketplace-hub-brand">
                  <PublicBrandMark />
                </div>
              </div>

              <div className="marketplace-hub-card wb">
                <span className="marketplace-hub-logo-card">
                  <MarketplaceLogo marketplace="wb" className="mockup-market-logo" decorative />
                </span>
                <span className="marketplace-hub-card-label">
                  <PublicIcon name="message" />
                  <span>Reviews and questions</span>
                </span>
              </div>
              <div className="marketplace-hub-card oz">
                <span className="marketplace-hub-logo-card">
                  <MarketplaceLogo marketplace="oz" className="mockup-market-logo" decorative />
                </span>
                <span className="marketplace-hub-card-label">
                  <PublicIcon name="message" />
                  <span>Supported messages</span>
                </span>
              </div>
              <div className="marketplace-hub-card ym">
                <span className="marketplace-hub-logo-card">
                  <MarketplaceLogo marketplace="ym" className="mockup-market-logo" decorative />
                </span>
                <span className="marketplace-hub-card-label">
                  <PublicIcon name="inbox" />
                  <span>Supported messages</span>
                </span>
              </div>
              <div className="marketplace-hub-card av">
                <span className="marketplace-hub-logo-card">
                  <MarketplaceLogo marketplace="av" className="mockup-market-logo" decorative />
                </span>
                <span className="marketplace-hub-card-label">
                  <PublicIcon name="message" />
                  <span>Buyer messages</span>
                </span>
              </div>

              <div className="marketplace-hero-note marketplace-hero-note-primary" aria-hidden="true">
                Customer messages
                <br />
                in one workspace
                <span>↙</span>
              </div>
              <div className="marketplace-hero-note marketplace-hero-note-sales" aria-hidden="true">
                One queue
                <br />
                for the team
              </div>
              <div className="mockup-mascot" aria-hidden="true" />
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="mockup-section-head">

              <h2>Wildberries, Ozon, Yandex Market, and Avito</h2>
            </div>

            <div className="marketplace-logo-grid">
              {integrations.map((integration) => (
                <Link className="marketplace-logo-card" href={integration.path} key={integration.key} aria-label={`View the ${integration.name} integration`}>
                  <Image
                    className="marketplace-brand-logo"
                    src={integration.logo.src}
                    width={integration.logo.width}
                    height={integration.logo.height}
                    alt={integration.name}
                    unoptimized
                  />
                  <p>{integration.text}</p>
                  <ul>
                    {integration.points.map((point) => <li key={point}>{point}</li>)}
                  </ul>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section mockup-section-soft">
          <div className="public-container">
            <div className="mockup-section-head">

              <h2>What one shared workflow changes</h2>
              <p>Connect the marketplaces your team uses and handle supported customer messages from one queue.</p>
            </div>
            <div className="marketplace-benefits-grid">
              {benefits.map(([icon, tone, title, text]) => (
                <article className="marketplace-benefit-card" key={title}>
                  <span className={`mockup-icon-chip ${tone === "blue" ? "" : tone}`} aria-hidden="true">
                    <PublicIcon name={icon} />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="public-container">
            <div className="mockup-section-head">

              <h2>Three steps to a working queue</h2>
              <p>Choose a marketplace, add the connection, and start working with the customer messages available through it.</p>
            </div>
            <div className="marketplace-connect-steps">
              {connectSteps.map(([icon, title, text], index) => (
                <article className="marketplace-connect-card" key={title}>
                  <span className={`mockup-icon-chip ${index === 1 ? "purple" : ""}`} aria-hidden="true">
                    <PublicIcon name={icon} />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

      </div>
    </PublicShell>
  );
}
