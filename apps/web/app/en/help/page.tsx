import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../../components/public-site/PublicShell";
import { createPageMetadata } from "../../../lib/seo";
import { getSiteConfig } from "../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "MPReply help and FAQ",
  description:
    "Find practical help for marketplace connections, the shared customer-message queue, AI-assisted drafts, review workflows, and MPReply automation.",
  path: "/help",
  locale: "en",
  localized: true,
});

const helpPaths = [
  {
    number: "01",
    title: "Connect a marketplace",
    text: "Choose Wildberries, Ozon, Yandex Market, or Avito. Availability depends on the current product version; supported customer messages appear in the shared workspace.",
    action: "Open integrations",
    href: "/en/marketplaces",
  },
  {
    number: "02",
    title: "Understand the customer-message queue",
    text: "Supported reviews, questions, and customer messages can be viewed in one queue and filtered by marketplace, type, and workflow state.",
    action: "Explore features",
    href: "/en/features",
  },
  {
    number: "03",
    title: "Set up review and automation",
    text: "Decide which replies may follow automation rules and which should be reviewed by a teammate first.",
    action: "View the workflow",
    href: "/en/demo",
  },
];

const troubleshooting = [
  {
    label: "Message is missing",
    title: "Check the connected seller account and source",
    text: "Make sure the right seller account is connected and the customer message is a supported type for that marketplace.",
  },
  {
    label: "Reply needs a decision",
    title: "Open the review queue",
    text: "When team review is required, the customer message stays in the review queue with its original context and prepared reply.",
  },
  {
    label: "Reply was not sent",
    title: "Check the marketplace connection",
    text: "If the marketplace rejected the action or account access changed, check the connection first and retry after the underlying issue is resolved.",
  },
];

const faq = [
  {
    question: "Which marketplaces are represented in MPReply?",
    answer: "MPReply is designed to work with Wildberries, Ozon, Yandex Market, and Avito. Availability of a specific connection depends on the current product version.",
  },
  {
    question: "What appears in the shared queue?",
    answer: "The shared queue shows customer-message types supported by the connected marketplace integration. The exact set depends on the marketplace and seller account.",
  },
  {
    question: "Are replies always sent automatically?",
    answer: "No. Automation rules can handle routine cases while complex or sensitive messages stay with a person for review.",
  },
  {
    question: "What does MPReply use when drafting a reply?",
    answer: "The draft uses the available customer-message and product context together with workspace settings. The team can review and edit the text before sending.",
  },
  {
    question: "Can a team work with multiple seller accounts?",
    answer: "Seller accounts are connected to the workspace, and supported customer messages can be filtered by marketplace, type, status, and assignee where available.",
  },
  {
    question: "What happens when a reply needs attention?",
    answer: "It stays in the review queue. A teammate sees the original context, prepared reply, and the state that requires a decision.",
  },
];

export default function EnglishHelpPage() {
  const siteConfig = getSiteConfig("en");
  return (
    <PublicShell locale="en">
      <section className="public-subhero help-approved-hero">
        <div className="public-container public-subhero-grid help-hero-grid">
          <div className="public-subhero-copy">
            <p className="eyebrow">Help center</p>
            <h1>Find the next step for what you are trying to do</h1>
            <p className="public-lead">
              Help is organized around real MPReply tasks: connecting marketplaces, working from the shared queue, reviewing replies, and setting up automation.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="#start">Start with a task</Link>
              <Link className="button button-secondary" href="/en/contacts">Contact support</Link>
            </div>
            <nav className="help-hero-shortcuts" aria-label="Help page sections">
              <a href="#start">Getting started</a>
              <a href="#troubleshooting">Troubleshooting</a>
              <a href="#faq">FAQ</a>
            </nav>
          </div>

          <div className="help-hero-scene" aria-label="MPReply help center overview">
            <div className="help-hero-window">
              <div className="help-hero-window-head">
                <div>
                  <span className="help-scene-mark" aria-hidden="true">?</span>
                  <div><strong>MPReply help</strong><small>Find help by task</small></div>
                </div>
                <span>All systems</span>
              </div>
              <div className="help-hero-search" aria-hidden="true">Search help…</div>
              <div className="help-hero-routes">
                <div className="help-hero-route help-hero-route-active"><span>01</span><div><strong>Connections</strong><small>Supported marketplaces</small></div></div>
                <div className="help-hero-route"><span>02</span><div><strong>Customer-message queue</strong><small>Reviews · questions · messages</small></div></div>
                <div className="help-hero-route"><span>03</span><div><strong>Reply review</strong><small>Review before sending</small></div></div>
              </div>
            </div>
            <div className="help-hero-resolution">
              <span className="panel-kicker">Scenario</span>
              <strong>Reply was not sent</strong>
              <p>Check the marketplace connection and retry after the underlying issue is resolved.</p>
              <span className="help-resolution-status">Next step identified →</span>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section help-start-section" id="start">
        <div className="public-container help-start-layout">
          <div className="help-section-intro">
            <p className="eyebrow">Getting started</p>
            <h2>Choose what you want to do now</h2>
            <p className="public-copy-muted">Each path leads to a concrete next action instead of a long catalogue of generic articles.</p>
          </div>
          <div className="help-path-list">
            {helpPaths.map((path) => (
              <article className="help-path" key={path.number}>
                <span className="help-path-number">{path.number}</span>
                <div>
                  <h3>{path.title}</h3>
                  <p>{path.text}</p>
                </div>
                <Link className="text-link" href={path.href}>{path.action} →</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section public-section-muted help-troubleshooting-section" id="troubleshooting">
        <div className="public-container">
          <div className="section-heading section-heading-wide">
            <p className="eyebrow">Troubleshooting</p>
            <h2>If the workflow has stopped</h2>
            <p>Start with the state you see in MPReply. These paths help narrow the cause and point you to the next place to check.</p>
          </div>
          <div className="help-troubleshooting-flow">
            {troubleshooting.map((item, index) => (
              <article className="help-troubleshooting-step" key={item.label}>
                <div className="help-troubleshooting-topline">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <small>{item.label}</small>
                </div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
          <div className="help-support-strip">
            <div>
              <span className="panel-kicker">Need help from the team</span>
              <strong>Include the marketplace, seller account, and current message state</strong>
              <p>That gives support enough context to understand the issue. Do not send secret access keys by email.</p>
            </div>
            <a className="button button-primary" href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
          </div>
        </div>
      </section>

      <section className="public-section help-faq-section" id="faq">
        <div className="public-container help-faq-layout">
          <div className="help-section-intro">
            <p className="eyebrow">FAQ</p>
            <h2>Quick answers before you get started</h2>
            <p className="public-copy-muted">Key questions about marketplace connections, the queue, reply drafting, and review before sending.</p>
          </div>
          <div className="help-faq-list">
            {faq.map((item, index) => (
              <details className="help-faq-item" key={item.question} open={index === 0}>
                <summary><span>{item.question}</span><i aria-hidden="true">+</i></summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div>
            <p className="eyebrow">Still not sure what to do?</p>
            <h2>Tell us where the workflow stopped</h2>
          </div>
          <a className="button button-primary button-on-dark" href={`mailto:${siteConfig.contactEmail}`}>Contact support</a>
        </div>
      </section>
    </PublicShell>
  );
}
