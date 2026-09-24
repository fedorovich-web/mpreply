import { IntegrationsWorkspace } from "../../../components/integrations/IntegrationsWorkspace";

export default function IntegrationsPage() {
  return (
    <section className="app-page app-page-wide integrations-page">
      <header className="app-header app-header-row integrations-page-header">
        <div>
          <p className="eyebrow">Интеграции</p>
          <h1>Подключите маркетплейсы к MPReply</h1>
          <p>
            Подключите Wildberries, Ozon, Яндекс Маркет и Авито, чтобы собирать обращения покупателей в MPReply. Здесь видно, какие кабинеты работают нормально, а какие нужно проверить.
          </p>
        </div>
        <div className="app-header-actions">
          <span className="status-badge">4 маркетплейса</span>
          <span className="status-badge">Единое управление</span>
        </div>
      </header>

      <IntegrationsWorkspace />
    </section>
  );
}
