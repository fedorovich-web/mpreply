import Link from "next/link";

import { WildberriesIntegrationWorkspace } from "../../../../../components/integrations/WildberriesIntegrationWorkspace";

export default function EnglishWildberriesIntegrationPage() {
  return (
    <section className="app-page app-page-wide marketplace-integration-page">
      <header className="app-header app-header-row marketplace-integration-header">
        <div>
          <p className="eyebrow">Wildberries</p>
          <h1>Connect Wildberries seller accounts</h1>
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

      <WildberriesIntegrationWorkspace />
    </section>
  );
}
