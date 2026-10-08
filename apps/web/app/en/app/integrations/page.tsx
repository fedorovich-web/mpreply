import { IntegrationsWorkspace } from "../../../../components/integrations/IntegrationsWorkspace";

export default function EnglishIntegrationsPage() {
  return (
    <section className="app-page app-page-wide integrations-page">
      <header className="app-header integrations-page-header">
        <h1>Integrations</h1>
        <p>
          Connect Wildberries, Ozon, Yandex Market, and Avito and check seller-account health from one workspace.
        </p>
      </header>

      <IntegrationsWorkspace />
    </section>
  );
}
