import Link from "next/link";

import { OzonIntegrationWorkspace } from "../../../../../components/integrations/OzonIntegrationWorkspace";

export default function EnglishOzonIntegrationPage() {
  return (
    <section className="app-page app-page-wide marketplace-integration-page">
      <header className="app-header app-header-row marketplace-integration-header">
        <div>
          <p className="eyebrow">Ozon</p>
          <h1>Connect Ozon seller accounts</h1>
          <p>
            Connect a Client ID and API key, sync reviews and questions, and send replies through MPReply.
          </p>
        </div>
        <div className="app-header-actions">
          <Link className="button button-secondary button-compact" href="/en/app/integrations">
            All integrations
          </Link>
          <span className="status-badge">Connection available</span>
        </div>
      </header>

      <OzonIntegrationWorkspace />
    </section>
  );
}
