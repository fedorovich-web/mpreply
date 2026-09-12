import Link from "next/link";

import { WildberriesIntegrationWorkspace } from "../../../../components/integrations/WildberriesIntegrationWorkspace";

export default function WildberriesIntegrationPage() {
  return (
    <section className="app-page app-page-wide wildberries-integration-page">
      <header className="app-header app-header-row wildberries-integration-header">
        <div>
          <p className="eyebrow">Wildberries</p>
          <h1>Кабинеты Wildberries и синхронизация</h1>
          <p>
            Подключайте кабинеты, проверяйте доступ, запускайте синхронизацию, обновляйте данные доступа и выбирайте режим обработки обращений покупателей.
          </p>
        </div>
        <div className="app-header-actions">
          <Link className="button button-secondary button-compact" href="/app/integrations">
            Все интеграции
          </Link>
          <span className="status-badge">Интеграция готова</span>
        </div>
      </header>

      <WildberriesIntegrationWorkspace />
    </section>
  );
}
