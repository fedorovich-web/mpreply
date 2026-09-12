import { IntegrationsWorkspace } from "../../../components/integrations/IntegrationsWorkspace";

export default function IntegrationsPage() {
  return (
    <section className="app-page app-page-wide">
      <header className="app-header app-header-row">
        <div>
          <p className="eyebrow">Интеграции</p>
          <h1>Подключите маркетплейсы к MPReply</h1>
          <p>
            Wildberries, Ozon, Яндекс Маркет и Авито доступны для подключения. Здесь можно видеть состояние кабинетов,
            открывать настройки интеграций и быстро находить подключения, которым требуется внимание.
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
