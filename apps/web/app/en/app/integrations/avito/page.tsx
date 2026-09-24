import Link from "next/link";

import { MarketplaceIntegrationWorkspace } from "../../../../../components/integrations/WildberriesIntegrationWorkspace";

export default function EnglishAvitoIntegrationPage() {
  return (
    <section className="app-page app-page-wide marketplace-integration-page">
      <header className="app-header app-header-row marketplace-integration-header">
        <div>
          <p className="eyebrow">Avito</p>
          <h1>Connect Avito seller accounts</h1>
          <p>
            Add seller accounts, validate access, sync buyer messages, and choose how MPReply should handle replies.
          </p>
        </div>
        <div className="app-header-actions">
          <Link className="button button-secondary button-compact" href="/en/app/integrations">
            All integrations
          </Link>
          <span className="status-badge">Connection available</span>
        </div>
      </header>

      <MarketplaceIntegrationWorkspace
        credentialLabel="Avito access credentials"
        marketplace="avito"
        marketplaceName="Avito"
        placeholder="For example, Avito — main account"
      />
    </section>
  );
}
