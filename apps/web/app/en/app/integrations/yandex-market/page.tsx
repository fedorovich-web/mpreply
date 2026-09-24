import Link from "next/link";

import { MarketplaceIntegrationWorkspace } from "../../../../../components/integrations/WildberriesIntegrationWorkspace";

export default function EnglishYandexMarketIntegrationPage() {
  return (
    <section className="app-page app-page-wide marketplace-integration-page">
      <header className="app-header app-header-row marketplace-integration-header">
        <div>
          <p className="eyebrow">Yandex Market</p>
          <h1>Connect Yandex Market seller accounts</h1>
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
        credentialLabel="Yandex Market access credentials"
        marketplace="yandex_market"
        marketplaceName="Yandex Market"
        placeholder="For example, Yandex Market — main store"
      />
    </section>
  );
}
