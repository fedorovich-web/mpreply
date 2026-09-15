import { IntegrationsWorkspace } from "../../../components/integrations/IntegrationsWorkspace";

export default function IntegrationsPage() {
  return (
    <section className="app-page app-page-wide">
      <header className="app-header app-header-row">
        <div>
          <p className="eyebrow">Интеграции</p>
          <h1>Подключения маркетплейсов и состояние API</h1>
          <p>
            Respio показывает кабинеты текущей организации. Планируемые подключения явно отделены от доступной интеграции Wildberries.
          </p>
        </div>
        <div className="app-header-actions">
          <span className="status-badge">Ключи зашифрованы</span>
          <span className="status-badge">Изоляция организаций</span>
        </div>
      </header>

      <IntegrationsWorkspace />
    </section>
  );
}
