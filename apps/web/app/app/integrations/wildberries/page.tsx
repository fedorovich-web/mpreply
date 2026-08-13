import Link from "next/link";

import { WildberriesIntegrationWorkspace } from "../../../../components/integrations/WildberriesIntegrationWorkspace";

export default function WildberriesIntegrationPage() {
  return (
    <section className="app-page app-page-wide">
      <header className="app-header app-header-row">
        <div>
          <h1>Кабинеты Wildberries</h1>
          <p>Подключайте кабинеты, проверяйте API-ключи и управляйте синхронизацией отзывов и вопросов.</p>
        </div>
        <div className="app-header-actions">
          <Link className="button button-secondary button-compact" href="/app/integrations">
            Все интеграции
          </Link>
          <span className="status-badge">Подключение доступно</span>
        </div>
      </header>

      <WildberriesIntegrationWorkspace />
    </section>
  );
}
