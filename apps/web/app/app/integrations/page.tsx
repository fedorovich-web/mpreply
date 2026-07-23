import { IntegrationsWorkspace } from "../../../components/integrations/IntegrationsWorkspace";

export default function IntegrationsPage() {
  return (
    <section className="app-page app-page-wide">
      <header className="app-header app-header-row">
        <div>
          <p className="eyebrow">Integrations</p>
          <h1>Подключения маркетплейсов и состояние API</h1>
          <p>
            Интерфейс показывает реальные кабинеты текущей организации и не выдаёт planned marketplace adapters за готовые production-интеграции.
          </p>
        </div>
        <div className="app-header-actions">
          <span className="status-badge">Encrypted credentials</span>
          <span className="status-badge">Tenant scoped</span>
        </div>
      </header>

      <IntegrationsWorkspace />
    </section>
  );
}
