import { IntegrationsWorkspace } from "../../../components/integrations/IntegrationsWorkspace";

export default function IntegrationsPage() {
  return (
    <section className="app-page app-page-wide integrations-page">
      <header className="app-header integrations-page-header">
        <h1>Интеграции</h1>
        <p>
          Подключайте Wildberries, Ozon, Яндекс Маркет и Авито и проверяйте состояние кабинетов в одном месте.
        </p>
      </header>

      <IntegrationsWorkspace />
    </section>
  );
}
