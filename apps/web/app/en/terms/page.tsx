import type { Metadata } from "next";

import { PublicShell } from "../../../components/public-site/PublicShell";
import { createPageMetadata } from "../../../lib/seo";
import { getSiteConfig } from "../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Terms of Use",
  description:
    "Draft MPReply Terms of Use covering marketplace customer messages, AI-assisted replies, automation, integrations, acceptable use, availability, and liability.",
  path: "/terms",
  locale: "en",
  localized: true,
  indexable: false,
});

const sections = [
  ["terms-subject", "1. Scope"],
  ["terms-auto-send", "2. Automatic sending"],
  ["terms-ai", "3. AI limitations"],
  ["terms-integrations", "4. Marketplace integrations"],
  ["terms-credentials", "5. Access credentials"],
  ["terms-acceptable-use", "6. Prohibited use"],
  ["terms-availability", "7. Availability and changes"],
  ["terms-liability", "8. Liability"],
  ["terms-termination", "9. Ending use of the service"],
] as const;

export default function EnglishTermsPage() {
  const siteConfig = getSiteConfig("en");

  return (
    <PublicShell locale="en">
      <section className="legal-hero legal-approved-hero">
        <div className="public-container legal-hero-inner">
          <p className="eyebrow">Legal draft</p>
          <h1>Terms of Use</h1>
          <p className="public-lead">
            Version dated September 20, 2026. Draft pending completion of the contracting-party details and final legal review.
          </p>
        </div>
      </section>

      <div className="public-container legal-approved-layout">
        <aside className="legal-toc" aria-label="Terms of Use contents">
          <span>Contents</span>
          <nav>
            {sections.map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}
          </nav>
        </aside>

        <article className="legal-approved-document">
          <aside className="legal-warning">
            <strong>This is not a final commercial offer or contract.</strong>
            <p>
              Before commercial launch, the contracting party and legal details, plan and payment terms, applicable law,
              support process, liability terms, and required notices must be defined. The only verified public contact
              for service questions is{" "}
              <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
            </p>
          </aside>

          <section id="terms-subject">
            <h2>1. Scope</h2>
            <p>
              MPReply is a service for handling reviews, questions, and supported customer messages, preparing
              AI-assisted replies, applying automation rules, and sending replies through connected marketplaces.
            </p>
          </section>

          <section id="terms-auto-send">
            <h2>2. Automatic sending</h2>
            <p>
              The service may send replies automatically when the user has enabled that mode and the relevant scenario
              is allowed by the user's rules and technical constraints. The user is responsible for configuring
              automation correctly and reviewing its results.
            </p>
          </section>

          <section id="terms-ai">
            <h2>3. AI limitations</h2>
            <p>
              A reply prepared with AI may contain errors. Without verified context, MPReply should not promise returns,
              replacements, compensation, medical or legal outcomes, delivery dates, or other facts not present in the
              input data.
            </p>
          </section>

          <section id="terms-integrations">
            <h2>4. Marketplace integrations</h2>
            <p>
              Functionality depends on the capabilities of the connection, granted permissions, limits, technical
              availability, and the rules of each marketplace. Changes made by a marketplace may temporarily affect
              individual integration workflows.
            </p>
          </section>

          <section id="terms-credentials">
            <h2>5. Access credentials</h2>
            <p>
              Users should provide only marketplace access keys and credentials they are authorized to use and should
              revoke or replace them promptly if compromise is suspected.
            </p>
          </section>

          <section id="terms-acceptable-use">
            <h2>6. Prohibited use</h2>
            <ul>
              <li>violating third-party rights or marketplace rules;</li>
              <li>providing another party's access credentials without authorization;</li>
              <li>bypassing marketplace limits or technical restrictions;</li>
              <li>using the service for unlawful, deceptive, or harmful automation.</li>
            </ul>
          </section>

          <section id="terms-availability">
            <h2>7. Availability and changes</h2>
            <p>
              Unverified availability guarantees or compensation commitments are not published before commercial terms
              are approved. Final service terms must be documented separately.
            </p>
          </section>

          <section id="terms-liability">
            <h2>8. Liability</h2>
            <p>
              Liability boundaries, limits, and exclusions must be defined in the final contractual document with
              regard to the actual business model and applicable law.
            </p>
          </section>

          <section id="terms-termination">
            <h2>9. Ending use of the service</h2>
            <p>
              The process for ending a subscription, exporting data, and deleting data must be defined before
              commercial launch and reflected in the product workflow.
            </p>
          </section>
        </article>
      </div>
    </PublicShell>
  );
}
