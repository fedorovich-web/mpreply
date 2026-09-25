import Link from "next/link";

import { YandexMarketIntegrationWorkspace } from "../../../../../components/integrations/YandexMarketIntegrationWorkspace";

export default function EnglishYandexMarketIntegrationPage() {
  return (
    <section className="app-page app-page-wide marketplace-integration-page">
      <header className="app-header app-header-row marketplace-integration-header">
        <div>
          <p className="eyebrow">Yandex Market</p>
          <h1>Connect Yandex Market seller accounts</h1>
          <p>
            Connect a Business ID and API key, sync reviews and questions, and send replies safely through MPReply.
          </p>
        </div>
        <div className="app-header-actions">
          <Link className="button button-secondary button-compact" href="/en/app/integrations">
            All integrations
          </Link>
          <span className="status-badge">Connection available</span>
        </div>
      </header>

      <YandexMarketIntegrationWorkspace />
    </section>
  );
}
