import Link from "next/link";

import { AvitoIntegrationWorkspace } from "../../../../../components/integrations/AvitoIntegrationWorkspace";

export default function EnglishAvitoIntegrationPage() {
  return (
    <section className="app-page app-page-wide marketplace-integration-page">
      <header className="app-header app-header-row marketplace-integration-header">
        <div>
          <p className="eyebrow">Avito</p>
          <h1>Connect Avito seller accounts</h1>
          <p>
            Connect an Avito User ID, Client ID, and Client Secret, sync chats, and reply to buyers from MPReply.
          </p>
        </div>
        <div className="app-header-actions">
          <Link className="button button-secondary button-compact" href="/en/app/integrations">
            All integrations
          </Link>
          <span className="status-badge">Connection available</span>
        </div>
      </header>

      <AvitoIntegrationWorkspace />
    </section>
  );
}
