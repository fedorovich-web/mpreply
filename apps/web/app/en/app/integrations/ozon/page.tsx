import Link from "next/link";

import { MarketplaceIntegrationWorkspace } from "../../../../../components/integrations/WildberriesIntegrationWorkspace";

export default function EnglishOzonIntegrationPage() {
  return (
    <section className="app-page app-page-wide marketplace-integration-page">
      <header className="app-header app-header-row marketplace-integration-header">
        <div>
          <p className="eyebrow">Ozon</p>
          <h1>Connect Ozon seller accounts</h1>
          <p>
            Add seller accounts, validate access, sync customer messages, and choose how MPReply should send replies.
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
        credentialLabel="Ozon access credentials"
        marketplace="ozon"
        marketplaceName="Ozon"
        placeholder="For example, Ozon — main store"
      />
    </section>
  );
}
