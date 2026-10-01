import type { Metadata } from "next";

import { PublicShell } from "../../../components/public-site/PublicShell";
import { createPageMetadata } from "../../../lib/seo";
import { getSiteConfig } from "../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Privacy Policy",
  description:
    "Draft MPReply Privacy Policy covering data categories, processing purposes, security, retention, marketplace access credentials, and user rights.",
  path: "/privacy",
  locale: "en",
  localized: true,
  indexable: false,
});

const sections = [
  ["privacy-general", "1. General provisions"],
  ["privacy-operator", "2. Who is the data controller"],
  ["privacy-data", "3. Data that may be processed"],
  ["privacy-purpose", "4. Purposes of processing"],
  ["privacy-ai", "5. AI and context sharing"],
  ["privacy-credentials", "6. Marketplace access credentials"],
  ["privacy-retention", "7. Retention and deletion"],
  ["privacy-rights", "8. User rights"],
  ["privacy-security", "9. Security"],
  ["privacy-changes", "10. Changes to this document"],
] as const;

export default function EnglishPrivacyPage() {
  const siteConfig = getSiteConfig("en");

  return (
    <PublicShell locale="en">
      <section className="legal-hero legal-approved-hero">
        <div className="public-container legal-hero-inner">

          <h1>Privacy Policy</h1>
          <p className="public-lead">
            Version dated September 20, 2026. This is a legal draft pending completion of the controller details and final legal review.
          </p>
        </div>
      </section>

      <div className="public-container legal-approved-layout">
        <aside className="legal-toc" aria-label="Privacy Policy contents">
          <span>Contents</span>
          <nav>
            {sections.map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}
          </nav>
        </aside>

        <div className="legal-approved-document">
          <aside className="legal-warning">
            <strong>Legal finalization is required before commercial launch.</strong>
            <p>
              The controller details must be completed, and the actual infrastructure, processes, contractors,
              localization, retention periods, consent flows, and applicable legal requirements must be reviewed.
            </p>
          </aside>

          <section id="privacy-general">
            <h2>1. General provisions</h2>
            <p>
              This document describes the intended principles for processing information in MPReply. It does not replace
              documents required from the actual controller and does not confirm that every process described here is
              already used in the commercial service.
            </p>
          </section>

          <section id="privacy-operator">
            <h2>2. Who is the data controller</h2>
            <p>
              Details of the legal entity or individual entrepreneur acting as controller must be added before
              commercial launch, including name, address, contact channel, and any other legally required information.
            </p>
          </section>

          <section id="privacy-data">
            <h2>3. Data that may be processed</h2>
            <ul>
              <li>account data such as email address, user identifier, and settings;</li>
              <li>company workspace and team membership data;</li>
              <li>marketplace access credentials required for connected integrations;</li>
              <li>reviews, questions, customer messages, and related data received from connected marketplaces;</li>
              <li>service data about AI usage needed for operation, diagnostics, and accounting;</li>
              <li>technical logs and security events with personal-data minimization.</li>
            </ul>
          </section>

          <section id="privacy-purpose">
            <h2>4. Purposes of processing</h2>
            <ul>
              <li>providing service functionality and account access;</li>
              <li>receiving customer messages and sending replies through marketplace connections;</li>
              <li>preparing AI-assisted reply drafts and controlling automation;</li>
              <li>detecting errors, maintaining security, and recording significant actions;</li>
              <li>supporting users and developing the product.</li>
            </ul>
          </section>

          <section id="privacy-ai">
            <h2>5. AI and context sharing</h2>
            <p>
              Only the context needed to process a customer message should be sent to an external generation service.
              Unnecessary personal data, secrets, access keys, and other credentials should not be included.
            </p>
          </section>

          <section id="privacy-credentials">
            <h2>6. Marketplace access credentials</h2>
            <p>
              Marketplace access keys and related credentials are processed inside the service and are not shown in
              the normal user interface or ordinary logs. MPReply is designed to encrypt such data at rest and support
              safe replacement of compromised credentials.
            </p>
          </section>

          <section id="privacy-retention">
            <h2>7. Retention and deletion</h2>
            <p>
              Specific retention periods must be defined before commercial launch for each data category. The
              architecture should support data minimization, deletion, and export to the extent required by applicable
              obligations.
            </p>
          </section>

          <section id="privacy-rights">
            <h2>8. User rights</h2>
            <p>
              A legally valid procedure for requests concerning access, correction, deletion, and restriction of
              processing must be approved together with the controller details. Until this document is finalized,
              public questions about the service may be sent to{" "}
              <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
            </p>
          </section>

          <section id="privacy-security">
            <h2>9. Security</h2>
            <p>
              Baseline measures include separation of data between organizations, access controls, encryption of
              marketplace credentials, protection against excessive requests, secure secret storage, recording of
              significant actions, backups, and personal-data minimization.
            </p>
          </section>

          <section id="privacy-changes">
            <h2>10. Changes to this document</h2>
            <p>
              The date and substance of changes should be recorded. Material changes should be published before a new
              version takes effect where required by applicable rules or contractual obligations.
            </p>
          </section>
        </div>
      </div>
    </PublicShell>
  );
}
