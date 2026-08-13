import { IntegrationsWorkspace } from "../../../components/integrations/IntegrationsWorkspace";

export default function IntegrationsPage() {
  return (
    <section className="app-page app-page-wide">
      <header className="app-header">
        <h1>Подключённые кабинеты маркетплейсов</h1>
        <p>Добавляйте кабинеты и проверяйте доступ, синхронизацию и ошибки подключения.</p>
      </header>

      <IntegrationsWorkspace />
    </section>
  );
}
