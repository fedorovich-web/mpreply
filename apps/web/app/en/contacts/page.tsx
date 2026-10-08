import type { Metadata } from "next";

import { ContactMailForm } from "../../../components/public-site/ContactMailForm";
import { PublicIcon } from "../../../components/public-site/PublicIcon";
import { PublicShell } from "../../../components/public-site/PublicShell";
import { createPageMetadata } from "../../../lib/seo";
import { siteConfig } from "../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Contact MPReply — support, demos, and marketplace setup",
  description:
    "Contact MPReply about marketplace connections, automation setup, product demos, and customer-message workflows.",
  path: "/contacts",
  locale: "en",
  localized: true,
});

export default function ContactsPage() {
  return (
    <PublicShell locale="en">
      <div className="contacts-render-page">
        <section className="contacts-render-hero">
          <div className="public-container contacts-render-hero-grid">
            <div className="contacts-render-hero-copy">

              <h1>Contact us</h1>
              <p>
                Ask a question, request a demo, or discuss your marketplace setup. Our official public support address is
                <strong>{siteConfig.contactEmail}</strong>.
              </p>
              <div className="contacts-render-trust" role="group" aria-label="Contact MPReply">
                <span><PublicIcon name="users" />One support channel</span>
                <span><PublicIcon name="inbox" />Official support email</span>
                <span><PublicIcon name="shield-check" />Do not send secret access keys</span>
              </div>
            </div>

            <div className="contacts-render-hero-scene" aria-hidden="true">
              <span className="contacts-render-scene-chip contacts-render-scene-mail"><PublicIcon name="inbox" /></span>
              <span className="contacts-render-scene-chip contacts-render-scene-help"><PublicIcon name="message" /></span>
              <div className="contacts-render-scene-bubble">
                <PublicIcon name="message" />
                <span><i /> <i /> <i /></span>
              </div>
              <div className="contacts-render-scene-status"><i />Official support email</div>
              <div className="contacts-render-scene-note">{siteConfig.contactEmail}</div>
            </div>
          </div>
        </section>

        <section className="contacts-render-main">
          <div className="public-container contacts-render-main-grid">
            <div className="contacts-render-form-card">
              <div className="contacts-render-section-head">
                <h2>Send us a message</h2>
                <p>Send us your question through the form. It will reach {siteConfig.contactEmail}.</p>
              </div>
              <ContactMailForm supportEmail={siteConfig.contactEmail} locale="en" />
            </div>

            <aside className="contacts-render-info-column" aria-label="MPReply contact information">
              <article className="contacts-render-office-card">
                <div className="contacts-render-info-icon"><PublicIcon name="inbox" /></div>
                <div>
                  <h3>Official support email</h3>
                  <p>{siteConfig.contactEmail}</p>
                  <span className="contacts-render-office-label">All public enquiries</span>
                </div>
                <div className="contacts-render-office-visual" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <b>MP</b>
                </div>
              </article>

              <article className="contacts-render-info-card">
                <span className="contacts-render-info-icon"><PublicIcon name="message" /></span>
                <div><h3>What to include</h3><p>Include the marketplace, seller account, task, and current message state — but never secret access keys.</p></div>
              </article>

              <article className="contacts-render-info-card">
                <span className="contacts-render-info-icon"><PublicIcon name="shield-check" /></span>
                <div><h3>Security</h3><p>Do not send access keys, passwords, or other secret credentials by email.</p></div>
              </article>
            </aside>
          </div>
        </section>

      </div>
    </PublicShell>
  );
}
