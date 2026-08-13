import Link from "next/link";

import { OzonIntegrationWorkspace } from "../../../../components/integrations/OzonIntegrationWorkspace";

export default function OzonIntegrationPage() {
  return (
    <section className="app-page app-page-wide">
      <header className="app-header app-header-row">
        <div>
          <h1>Кабинеты Ozon</h1>
          <p>Подключайте Client ID и API-ключ, проверяйте права и управляйте синхронизацией отзывов и вопросов.</p>
        </div>
        <div className="app-header-actions">
          <Link className="button button-secondary button-compact" href="/app/integrations">
            Все интеграции
          </Link>
          <span className="status-badge">Подключение доступно</span>
        </div>
      </header>

      <OzonIntegrationWorkspace />
    </section>
  );
}
