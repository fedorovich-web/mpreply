import { IntegrationsWorkspace } from "../../../components/integrations/IntegrationsWorkspace";

export default function IntegrationsPage() {
  return (
    <section className="app-page app-page-wide integrations-page">
      <header className="app-header app-header-row integrations-page-header">
        <div>
          <p className="eyebrow">Интеграции</p>
          <h1>Подключения маркетплейсов без ложной готовности</h1>
          <p>
            Wildberries доступен сейчас: подключайте кабинеты, следите за синхронизацией и состоянием доступа. Ozon, Яндекс Маркет и Авито находятся в плане интеграций и пока не открыты для подключения.
          </p>
        </div>
        <div className="app-header-actions" aria-label="Текущий статус интеграций">
          <span className="status-badge">Wildberries доступен</span>
          <span className="status-badge">3 интеграции в плане</span>
        </div>
      </header>

      <IntegrationsWorkspace />
    </section>
  );
}
