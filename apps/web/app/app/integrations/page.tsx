import { IntegrationsWorkspace } from "../../../components/integrations/IntegrationsWorkspace";

export default function IntegrationsPage() {
  return (
    <section className="app-page app-page-wide integrations-page">
      <header className="app-header app-header-row integrations-page-header">
        <div>
          <p className="eyebrow">Интеграции</p>
          <h1>Подключения маркетплейсов</h1>
          <p>
            Wildberries доступен для подключения. Ozon, Яндекс Маркет и Авито — в плане интеграций. Здесь можно управлять рабочими подключениями и видеть честный статус площадок без недоступных действий.
          </p>
        </div>
        <div className="app-header-actions">
          <span className="status-badge">1 доступен</span>
          <span className="status-badge">3 в плане</span>
        </div>
      </header>

      <IntegrationsWorkspace />
    </section>
  );
}
